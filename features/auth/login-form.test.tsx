import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const LOGIN_RESULT = { data: { user: { id: "u1" }, session: { id: "s1" } } };

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

async function fillValidCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "admin@example.com");
  await user.type(screen.getByLabelText("Пароль"), "Admin123!");
}

describe("LoginForm validation", () => {
  it("shows a required error for an empty email and does not submit", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<LoginForm redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText("Пароль"), "Admin123!");
    await user.click(screen.getByRole("button", { name: /войти/i }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a format error for an invalid email and does not submit", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<LoginForm redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Пароль"), "Admin123!");
    await user.click(screen.getByRole("button", { name: /войти/i }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a required error for an empty password and does not submit", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<LoginForm redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.click(screen.getByRole("button", { name: /войти/i }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("LoginForm submission", () => {
  it("submits email, password, and rememberMe once the checkbox is checked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, LOGIN_RESULT)));
    render(<LoginForm redirectTo="/dashboard" />);

    await fillValidCredentials(user);
    await user.click(screen.getByRole("checkbox", { name: "Запомнить меня" }));
    await user.click(screen.getByRole("button", { name: /войти/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          body: JSON.stringify({
            email: "admin@example.com",
            password: "Admin123!",
            rememberMe: true,
          }),
        })
      )
    );
  });

  it("disables the submit button while the request is pending", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));
    render(<LoginForm redirectTo="/dashboard" />);

    await fillValidCredentials(user);
    const submitButton = screen.getByRole("button", { name: /войти/i });
    await user.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());

    resolveFetch(jsonResponse(200, LOGIN_RESULT));
    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  it("prevents a duplicate submit while a request is already pending", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm redirectTo="/dashboard" />);

    await fillValidCredentials(user);
    const submitButton = screen.getByRole("button", { name: /войти/i });
    await user.click(submitButton);
    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, LOGIN_RESULT));
    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });
});

describe("LoginForm API errors", () => {
  it("shows a message for invalid credentials (401) without navigating", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Invalid" } }))
    );
    render(<LoginForm redirectTo="/dashboard" />);

    await fillValidCredentials(user);
    await user.click(screen.getByRole("button", { name: /войти/i }));

    expect(await screen.findByText("Неверный email или пароль")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a message for a 400 response without navigating", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Bad" } }))
    );
    render(<LoginForm redirectTo="/dashboard" />);

    await fillValidCredentials(user);
    await user.click(screen.getByRole("button", { name: /войти/i }));

    expect(await screen.findByText("Проверьте правильность заполнения формы")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a network error message and resets the loading state", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<LoginForm redirectTo="/dashboard" />);

    await fillValidCredentials(user);
    const submitButton = screen.getByRole("button", { name: /войти/i });
    await user.click(submitButton);

    expect(
      await screen.findByText("Не удалось соединиться с сервером. Проверьте подключение к интернету")
    ).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("LoginForm redirect", () => {
  it("navigates to the default authenticated route when no redirect was requested", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, LOGIN_RESULT)));
    render(<LoginForm redirectTo="/dashboard" />);

    await fillValidCredentials(user);
    await user.click(screen.getByRole("button", { name: /войти/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("navigates to the pre-resolved internal redirect target on success", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, LOGIN_RESULT)));
    render(<LoginForm redirectTo="/lists/123?tab=done" />);

    await fillValidCredentials(user);
    await user.click(screen.getByRole("button", { name: /войти/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/lists/123?tab=done"));
  });
});
