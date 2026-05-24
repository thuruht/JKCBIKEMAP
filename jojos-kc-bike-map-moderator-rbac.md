# JOJO's KC Bike Map Moderator Role and RBAC Schema

JOJO's KC Bike Map should treat moderators as a content-and-safety role rather than a platform-control role.[cite:9][cite:39] Moderators are best used to keep map data and discussions healthy, while administrators retain irreversible, system-wide, and trust-critical powers.[cite:1][cite:2][cite:38]

## Recommended Moderator Scope

Moderators should be allowed to manage community-generated content across the map, including editing public-facing feature fields, hiding problematic entries, resolving abuse reports, and removing inappropriate comments.[cite:1][cite:3][cite:5] This aligns with common community moderation patterns in which moderators handle day-to-day quality control and safety enforcement without owning platform configuration.[cite:1][cite:2]

Recommended moderator capabilities:

- Edit any feature's public fields, such as title, description, category, tags, and obvious factual cleanup.[cite:1][cite:3]
- Correct geometry when the change is low-risk and clearly improves accuracy, such as moving a marker to the correct trail access point.[cite:1][cite:3]
- Hide or soft-delete spam, vandalism, abusive submissions, and unsafe public disclosures pending review.[cite:5][cite:39]
- Delete or hide inappropriate comments, lock threads, and resolve reports related to discussion behavior.[cite:3][cite:5][cite:10]
- Temporarily mute users from commenting when the violation is clear and limited in scope.[cite:5]

Moderators should not be allowed to import official trail data, change system settings, assign roles, permanently ban users, or perform hard deletes.[cite:2][cite:9][cite:38] Those actions carry higher operational or governance risk and fit better under admin control.[cite:38][cite:39]

## Sensitive Content Policy

Sensitive content should be split from ordinary feature access so moderation does not automatically imply full disclosure.[cite:36][cite:39][cite:44] Least-privilege guidance supports granting only the minimum access needed to evaluate reports and protect the public map.[cite:36][cite:39]

A strong default is to give moderators a limited review permission rather than blanket sensitive-data access:[cite:36][cite:44]

- Moderators can see that a feature is sensitive, why it was flagged, its moderation history, and enough coarse location context to assess risk.[cite:36][cite:44]
- Moderators can redact public-facing text or hide the feature from public view immediately.[cite:39][cite:42]
- Moderators cannot view the full sensitive payload unless an admin explicitly grants or performs the review.[cite:36][cite:39]
- Admins retain full access and final authority to change a feature's sensitive-status rules.[cite:2][cite:38]

This approach supports fast safety response without turning moderators into de facto admins.[cite:39][cite:44]

## Role Matrix

| Resource / Action | Public | User | Contributor | Moderator | Admin |
|---|---|---|---|---|---|
| View non-sensitive features | R [cite:22] | R [cite:22] | R [cite:22] | R [cite:22] | R [cite:25] |
| View full sensitive feature details | - | - | R [cite:22] | Limited review only [cite:36][cite:44] | R [cite:25] |
| Create feature | - | C [cite:22] | C [cite:22] | C [cite:22] | C [cite:25] |
| Edit own feature | - | U [cite:22] | U [cite:22] | U [cite:22] | U [cite:25] |
| Edit any feature public fields | - | - | - | U [cite:1][cite:3] | U [cite:25] |
| Edit any feature geometry | - | - | - | U [cite:1][cite:3] | U [cite:25] |
| Hide / soft-delete any feature | - | - | - | H/D [cite:5][cite:39] | H/D [cite:25] |
| Hard-delete feature | - | - | - | - | D [cite:39] |
| Delete / hide any comment | - | - | - | D/H [cite:3][cite:10] | D/H [cite:25] |
| Lock comment thread | - | - | - | M [cite:5] | M [cite:25] |
| Temporarily mute user comments | - | - | - | M [cite:5] | M [cite:25] |
| Permanently ban user | - | - | - | - | M [cite:38][cite:39] |
| Assign or revoke roles | - | - | - | - | U [cite:2][cite:38] |
| Import official trail data | - | - | - | - | C [cite:9][cite:38] |
| Change site-wide settings | - | - | - | - | C/U [cite:2][cite:38] |

## JSON-Style Permission Schema

A granular permission schema keeps roles composable and makes it easier to separate content moderation from system administration.[cite:35][cite:38] The following structure is suitable for an application backend, policy engine, or IDE agent prompt context.[cite:35][cite:41]

```json
{
  "roles": {
    "public": [
      "feature.public.read",
      "user.profile.public.read"
    ],
    "user": [
      "feature.public.read",
      "feature.own.create",
      "feature.own.read",
      "feature.own.update",
      "feature.own.request_sensitive",
      "comment.own.create",
      "comment.own.read",
      "comment.own.update",
      "comment.own.delete",
      "report.create",
      "user.profile.public.read"
    ],
    "contributor": [
      "feature.public.read",
      "feature.sensitive.read",
      "feature.own.create",
      "feature.own.read",
      "feature.own.update",
      "feature.own.request_sensitive",
      "comment.own.create",
      "comment.own.read",
      "comment.own.update",
      "comment.own.delete",
      "report.create",
      "user.profile.public.read"
    ],
    "moderator": [
      "feature.public.read",
      "feature.sensitive.moderation_read",
      "feature.any.read_metadata",
      "feature.any.update_public_fields",
      "feature.any.update_geometry",
      "feature.any.hide",
      "feature.any.soft_delete",
      "feature.any.lock",
      "feature.sensitive.redact_public",
      "comment.any.read",
      "comment.any.hide",
      "comment.any.delete",
      "comment.thread.lock",
      "report.read",
      "report.resolve",
      "user.profile.public.read",
      "user.comment_mute.temporary"
    ],
    "admin": [
      "feature.public.read",
      "feature.sensitive.read",
      "feature.any.read",
      "feature.any.create",
      "feature.any.update",
      "feature.any.hide",
      "feature.any.soft_delete",
      "feature.any.hard_delete",
      "feature.sensitive.toggle",
      "feature.import_official",
      "comment.any.read",
      "comment.any.hide",
      "comment.any.delete",
      "comment.thread.lock",
      "report.read",
      "report.resolve",
      "user.profile.public.read",
      "user.reputation.adjust",
      "user.role.assign",
      "user.ban.permanent",
      "badge.assign",
      "system.settings.update",
      "moderation.audit.read"
    ]
  }
}
```

## Permission Design Notes

Permission names are easiest to maintain when they follow a stable pattern such as `resource.scope.action`.[cite:38][cite:41] Distinguishing `soft_delete` from `hard_delete` and `moderation_read` from full `read` reduces privilege creep and keeps dangerous actions explicit.[cite:39][cite:42]

Suggested meanings for the sensitive-content permissions:

```json
{
  "permissions": {
    "feature.sensitive.read": "Full sensitive content and precise location details",
    "feature.sensitive.moderation_read": "Limited review view: reason flag, rough area, report history, and moderation metadata",
    "feature.sensitive.redact_public": "Hide or remove public-facing text without viewing full sensitive payload",
    "feature.sensitive.toggle": "Change whether a feature is marked sensitive"
  }
}
```

This model lets moderators respond quickly to risky content while preserving admin review for disclosures, role changes, and irreversible actions.[cite:36][cite:39][cite:44]

## Policy Examples

RBAC works best when paired with scope checks such as ownership, record state, and escalation flags.[cite:25][cite:40] The following policy examples show how the permission strings can be combined with application rules.[cite:40]

```json
{
  "policies": [
    {
      "permission": "feature.own.update",
      "allow_if": ["user.id == feature.created_by"]
    },
    {
      "permission": "feature.any.update_public_fields",
      "allow_if": ["user.role in ['moderator', 'admin']"]
    },
    {
      "permission": "feature.sensitive.moderation_read",
      "allow_if": [
        "user.role in ['moderator', 'admin']",
        "feature.is_sensitive == true",
        "feature.is_flagged_for_review == true"
      ]
    }
  ]
}
```

This structure gives an IDE agent enough context to generate backend guards, database policies, and UI affordances consistently.[cite:35][cite:40]
