export const publishStatuses = ["draft", "published", "archived"] as const;
export type PublishStatus = (typeof publishStatuses)[number];

export const reviewStatuses = ["pending_review", "approved", "rejected"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const activationStatuses = ["red", "yellow", "green"] as const;
export type ActivationStatus = (typeof activationStatuses)[number];

export const adminRoles = ["super_admin"] as const;
export type AdminRole = (typeof adminRoles)[number];
