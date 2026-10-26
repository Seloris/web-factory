import { computed, linkedSignal, resource } from '@angular/core';

export function resourceState<T>(loader: () => Promise<T>) {
  const r = resource({ loader });
  return {
    data: computed(() => (r.hasValue() ? r.value() : undefined)),
    isLoading: computed(() => r.isLoading()),
    hasError: computed(() => r.status() === 'error'),
    reload: () => r.reload(),
  };
}

export function resourceStateWithParams<TParams, T>(
  params: () => TParams,
  loader: (params: NoInfer<TParams>) => Promise<T>
) {
  const r = resource({
    params,
    loader: ({ params }) => loader(params),
  });
  const lastData = linkedSignal<
    { value: T | undefined; error: boolean },
    T | undefined
  >({
    source: () => ({
      value: r.hasValue() ? r.value() : undefined,
      error: r.status() === 'error',
    }),
    computation: (s, prev) => (s.error ? undefined : (s.value ?? prev?.value)),
  });
  return {
    data: computed(() => (r.hasValue() ? r.value() : undefined)),
    // Keeps the previous value while a new one loads; cleared on error.
    lastData: lastData.asReadonly(),
    isLoading: computed(() => r.isLoading()),
    hasError: computed(() => r.status() === 'error'),
    reload: () => r.reload(),
  };
}
