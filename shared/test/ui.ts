import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

export async function chooseSelectOption(
  user: UserEvent,
  trigger: HTMLElement,
  optionName: string | RegExp,
) {
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: optionName }));
}
