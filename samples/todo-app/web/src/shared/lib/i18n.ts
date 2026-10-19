// The French dictionary: every user-facing string of the application.
const fr = {
  "home.title": "Mes tâches",
  "home.form.name": "Nom",
  "home.form.tag": "Tag (optionnel)",
  "home.form.submit": "Ajouter",
  "home.form.nameRequired": "Le nom est obligatoire.",
  "home.form.nameInvalid": "Le nom doit contenir entre 1 et 200 caractères.",
  "home.form.tagInvalid": "Le tag doit contenir au plus 30 caractères.",
  "home.filters.search": "Rechercher",
  "home.filters.tag": "Tag",
  "home.filters.allTags": "Tous les tags",
  "home.filters.sortByState": "Non terminées d'abord",
  "home.list.loading": "Chargement…",
  "home.list.error": "Impossible de charger les tâches.",
  "home.list.empty": "Aucune tâche pour l'instant : ajoutez la première !",
  "home.list.noMatch": "Aucune tâche ne correspond à votre recherche.",
  "home.item.toggle": "« {name} » terminée",
  "home.item.pin": "Épingler",
  "home.item.delete": "Supprimer",
  "home.delete.title": "Supprimer la tâche ?",
  "home.delete.message": "La tâche « {name} » sera supprimée définitivement.",
  "home.delete.confirm": "Supprimer",
  "home.delete.cancel": "Annuler",
  "common.error.generic": "Une erreur est survenue. Réessayez.",
  "common.action.retry": "Réessayer",
} as const;

export type TranslationKey = keyof typeof fr;

export function t(key: TranslationKey, params?: Record<string, string>): string {
  return fr[key].replace(/\{(\w+)\}/g, (placeholder, name: string) => params?.[name] ?? placeholder);
}
