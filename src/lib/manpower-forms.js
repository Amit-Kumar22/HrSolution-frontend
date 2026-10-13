export const SKILL_LEVELS = Object.freeze(["UNSKILLED", "SEMI_SKILLED", "SKILLED", "HIGHLY_SKILLED"]);

export const SKILL_LEVEL_LABELS = Object.freeze({
  UNSKILLED: "Unskilled",
  SEMI_SKILLED: "Semi-skilled",
  SKILLED: "Skilled",
  HIGHLY_SKILLED: "Highly skilled",
});

export const SKILL_LEVEL_TONES = Object.freeze({
  UNSKILLED: "neutral",
  SEMI_SKILLED: "info",
  SKILLED: "accent",
  HIGHLY_SKILLED: "success",
});

export function skillLevelLabel(level) {
  return SKILL_LEVEL_LABELS[level] || level || "—";
}

export const CATEGORY_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,39}$/;

export const EMPTY_CATEGORY_FORM = Object.freeze({
  code: "",
  name: "",
  skillLevel: "UNSKILLED",
  description: "",
  displayOrder: "",
  active: true,
});

export function categoryToForm(item) {
  return {
    code: item.code || "",
    name: item.name || "",
    skillLevel: SKILL_LEVELS.includes(item.skillLevel) ? item.skillLevel : "UNSKILLED",
    description: item.description || "",
    displayOrder: item.displayOrder ?? "",
    active: item.active !== false,
  };
}

export function categoryFormToPayload(form) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    skillLevel: form.skillLevel,
    description: form.description.trim(),
    displayOrder: form.displayOrder === "" || form.displayOrder == null ? 0 : Number(form.displayOrder),
    active: Boolean(form.active),
  };
}

export function validateCategory(form) {
  const errors = {};
  if (!form.code.trim()) {
    errors.code = "Code is required.";
  } else if (!CATEGORY_CODE_PATTERN.test(form.code.trim())) {
    errors.code = "Start with a letter, then use letters, numbers or underscores (2–40 characters).";
  }
  if (!form.name.trim()) {
    errors.name = "Name is required.";
  } else if (form.name.trim().length > 120) {
    errors.name = "Name must be 120 characters or fewer.";
  }
  if (!SKILL_LEVELS.includes(form.skillLevel)) {
    errors.skillLevel = "Choose a valid skill level.";
  }
  if (form.description.trim().length > 500) errors.description = "Description must be 500 characters or fewer.";
  if (form.displayOrder !== "" && !Number.isFinite(Number(form.displayOrder))) {
    errors.displayOrder = "Display order must be a whole number.";
  }
  return errors;
}

export const EMPTY_SKILL_FORM = Object.freeze({
  name: "",
  description: "",
  active: true,
});

export function skillToForm(item) {
  return {
    name: item.name || "",
    description: item.description || "",
    active: item.active !== false,
  };
}

export function skillFormToPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    active: Boolean(form.active),
  };
}

export function validateSkill(form) {
  const errors = {};
  if (!form.name.trim()) {
    errors.name = "Skill name is required.";
  } else if (form.name.trim().length > 120) {
    errors.name = "Skill name must be 120 characters or fewer.";
  }
  if (form.description.trim().length > 500) errors.description = "Description must be 500 characters or fewer.";
  return errors;
}