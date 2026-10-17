import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toProblem, type ProblemDetails } from "../../../api/client.ts";
import { todoKeys } from "./todoKeys.ts";

export function useDeleteTodoMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ProblemDetails, { id: number }>({
    mutationFn: async ({ id }) => {
      const { error, response } = await api.DELETE("/v1/todos/{id}", { params: { path: { id } } });
      if (!response.ok) throw toProblem(error, response);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
