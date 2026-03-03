export function chooseModel(taskClass = "implement", config = {}) {
  const models = config.models ?? {};

  if (taskClass === "architecture" || taskClass === "contracts") {
    return {
      model: models.architecture?.model ?? "gemini-3.1-pro-preview",
      thinking_level: models.architecture?.thinking_level ?? "high"
    };
  }

  if (taskClass === "normalize" || taskClass === "review") {
    return {
      model: models.normalize?.model ?? "gemini-3.1-flash-lite-preview",
      thinking_level: models.normalize?.thinking_level ?? "low"
    };
  }

  return {
    model: models.implement?.model ?? "gemini-3-flash-preview",
    thinking_level: models.implement?.thinking_level ?? "medium"
  };
}

export function classifyTask(objective = "") {
  const text = objective.toLowerCase();
  if (/(arquitect|architecture|contract|schema|refactor grande)/.test(text)) return "architecture";
  if (/(normaliza|lint|review|micro)/.test(text)) return "normalize";
  return "implement";
}
