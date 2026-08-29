import { useCallback, useState } from "react";

export interface UseOptimisticMutationParams<TState, TVariables, TResult = void> {
  getState: () => TState;
  setState: (state: TState) => void;
  applyOptimisticUpdate: (state: TState, variables: TVariables) => TState;
  mutationFn: (variables: TVariables) => Promise<TResult>;
  onError?: (error: unknown, variables: TVariables) => void;
  onSuccess?: (result: TResult, variables: TVariables) => void;
}

export interface UseOptimisticMutationResult<TVariables, TResult> {
  mutate: (variables: TVariables) => Promise<TResult>;
  isPending: boolean;
  error: unknown;
}

export function useOptimisticMutation<TState, TVariables, TResult = void>({
  getState,
  setState,
  applyOptimisticUpdate,
  mutationFn,
  onError,
  onSuccess,
}: UseOptimisticMutationParams<TState, TVariables, TResult>): UseOptimisticMutationResult<
  TVariables,
  TResult
> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutate = useCallback(
    async (variables: TVariables) => {
      const previousState = getState();
      setState(applyOptimisticUpdate(previousState, variables));
      setIsPending(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        onSuccess?.(result, variables);
        return result;
      } catch (err) {
        setState(previousState);
        setError(err);
        onError?.(err, variables);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [getState, setState, applyOptimisticUpdate, mutationFn, onError, onSuccess]
  );

  return { mutate, isPending, error };
}
