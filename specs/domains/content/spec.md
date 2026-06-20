# Content Domain Specification
## نطاق إدارة المحتوى — AlharisTech Platform

**Domain ID:** `content`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 1
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Content domain is responsible for:
- Page management (CRUD, publish/unpublish, scheduling)
- Rich text editing with structured content (JSONB)
- Media library (upload, categorize, delete)
- Blog posts with tags and categories
- SEO metadata management
- Menu management (header, footer)
- Version history and rollback
- Sitemap auto-generation

### What Content does NOT manage
- User authentication/authorization (→ delegates to Identity domain)
- Notification delivery on page publish (→ delegates to Notification domain)
- Analytics tracking (→ Analytics domain)
- Media file storage (→ delegates to Storage infrastructure layer)

### Relationships
```
Content ──► requires auth ──► Identity
Content ──► publishes PagePublished ──► Notification, Sitemap
Content ──► publishes MediaUploaded ──► Storage audit
Content ──► publishes BlogPostPublished ──► Notification
```

---

## 2. Aggregates

### 2.1 Page Aggregate
**Root Entity:** Page

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| title_ar | VARCHAR(255) | Required |
| title_en | VARCHAR(255) | Optional |
| slug | VARCHAR(255) | Unique, URL-safe, Required |
| content_ar | JSONB | TipTap/Slate document structure |
| content_en | JSONB | TipTap/Slate document structure, Optional |
| meta_title | VARCHAR(160) | Optional, SEO |
| meta_description | TEXT | Optional, SEO, max 320 chars |
| is_published | BOOLEAN | Default: false |
| published_at | TIMESTAMP | Nullable, set on first publish |
| scheduled_at | TIMESTAMP | Nullable, BullMQ job ID stored |
| created_by | UUID | FK → users.id, Not null |
| updated_by | UUID | FK → users.id, Nullable |
| version | INTEGER | Default: 1, incremented on edit |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |
| deleted_at | TIMESTAMP | Nullable (soft delete) |

### 2.2 PageVersion Aggregate
**Root Entity:** PageVersion

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| page_id | UUID | FK → pages.id, Not null |
| version | INTEGER | Version number |
| snapshot | JSONB | Full page state at this version |
| change_summary | VARCHAR(500) | Optional, what changed |
| created_by | UUID | FK → users.id, Not null |
| created_at | TIMESTAMP | Auto |

### 2.3 BlogPost Aggregate
**Root Entity:** BlogPost

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| title_ar | VARCHAR(255) | Required |
| title_en | VARCHAR(255) | Optional |
| slug | VARCHAR(255) | Unique, URL-safe, Required |
| content_ar | JSONB | TipTap/Slate document structure |
| content_en | JSONB | TipTap/Slate document structure, Optional |
| excerpt_ar | TEXT | Optional, max 500 chars |
| excerpt_en | TEXT | Optional, max 500 chars |
| featured_image | UUID | FK → media.id, Nullable |
| tags | JSONB | Array of strings, e.g., ["tech","news"] |
| category_id | UUID | FK → blog_categories.id, Nullable |
| meta_title | VARCHAR(160) | Optional, SEO |
| meta_description | TEXT | Optional, SEO, max 320 chars |
| is_published | BOOLEAN | Default: false |
| published_at | TIMESTAMP | Nullable |
| scheduled_at | TIMESTAMP | Nullable, BullMQ job ID stored |
| created_by | UUID | FK → users.id, Not null |
| updated_by | UUID | FK → users.id, Nullable |
| version | INTEGER | Default: 1 |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |
| deleted_at | TIMESTAMP | Nullable (soft delete) |

### 2.4 BlogCategory Aggregate
**Root Entity:** BlogCategory

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name_ar | VARCHAR(100) | Required |
| name_en | VARCHAR(100) | Optional |
| slug | VARCHAR(255) | Unique, URL-safe, Required |
| description_ar | TEXT | Optional |
| description_en | TEXT | Optional |
| parent_id | UUID | FK → blog_categories.id, Nullable |
| sort_order | INTEGER | Default: 0 |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

### 2.5 Media Aggregate
**Root Entity:** Media

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| filename | VARCHAR(255) | Original filename on storage |
| original_name | VARCHAR(255) | User-uploaded filename |
| mime_type | VARCHAR(100) | e.g., "image/png" |
| size_bytes | BIGINT | File size |
| url | TEXT | Public/accessible URL |
| thumbnail_url | TEXT | Nullable, generated thumbnail |
| alt_text_ar | VARCHAR(255) | Optional, accessibility |
| alt_text_en | VARCHAR(255) | Optional, accessibility |
| folder | VARCHAR(255) | Optional, virtual folder/category |
| uploaded_by | UUID | FK → users.id, Not null |
| created_at | TIMESTAMP | Auto |
| deleted_at | TIMESTAMP | Nullable (soft delete) |

### 2.6 Menu Aggregate
**Root Entity:** Menu

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name | VARCHAR(100) | Required, unique |
| location | ENUM('header','footer','sidebar','custom') | Required |
| items | JSONB | Recursive menu tree structure |
| is_active | BOOLEAN | Default: true |
| created_by | UUID | FK → users.id, Not null |
| updated_by | UUID | FK → users.id, Nullable |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Menu items JSONB structure:**
```json
[
  {
    "id": "uuid",
    "label_ar": "string",
    "label_en": "string",
    "url": "string",
    "type": "internal|external|page_link",
    "page_id": "uuid|null",
    "icon": "string|null",
    "open_in_new_tab": false,
    "sort_order": 0,
    "children": []
  }
]
```

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `PagePublished` | Page is_published changed to true | `{ pageId, slug, title_ar, title_en, publishedBy, publishedAt }` | Notification (content published alert), Sitemap (regenerate) |
| `PageUnpublished` | Page is_published changed to false | `{ pageId, slug, title_ar, unpublishedBy, unpublishedAt }` | Sitemap (regenerate) |
| `PageScheduled` | Scheduled publish timestamp set | `{ pageId, slug, title_ar, scheduledBy, scheduledAt, jobId }` | BullMQ (schedule job) |
| `MediaUploaded` | New media file uploaded | `{ mediaId, filename, mimeType, sizeBytes, uploadedBy, uploadedAt }` | Storage audit log |
| `MediaDeleted` | Media file deleted | `{ mediaId, filename, deletedBy, deletedAt }` | Storage (cleanup physical file) |
| `BlogPostPublished` | Blog post is_published changed to true | `{ postId, slug, title_ar, categoryId, tags, publishedBy, publishedAt }` | Notification (new blog alert), Sitemap (regenerate) |
| `MenuUpdated` | Menu items changed | `{ menuId, name, location, updatedBy, updatedAt }` | Frontend cache invalidation |

---

## 4. Use Cases

### UC-CONTENT-01: Create Page
**Actor:** Admin, Manager, Employee (with content:create permission)
**Preconditions:** Authenticated, slug is unique
**Flow:**
1. Actor submits page data (title_ar, slug, content_ar, meta_title, meta_description, etc.)
2. System validates inputs (Zod schema)
3. System checks slug uniqueness
4. System creates Page with version=1, is_published=false, created_by=current user
5. System creates PageVersion snapshot (version 1)
6. Response: 201 Created with page data

**Exceptions:**
- Slug already exists → 409 Conflict
- Validation failure → 422 Unprocessable Entity
- Unauthorized → 403 Forbidden

### UC-CONTENT-02: Edit Page
**Actor:** Admin, Manager, Employee (with content:update permission on page)
**Preconditions:** Page exists, not deleted
**Flow:**
1. Actor submits updated fields
2. System validates inputs
3. If slug changed, check uniqueness
4. System increments version
5. System updates page fields
6. System creates new PageVersion snapshot
7. Response: 200 OK

**Exceptions:**
- Page not found → 404 Not Found
- Page soft-deleted → 410 Gone
- Slug conflict → 409 Conflict
- Published page content edit allowed (no restriction; version tracks changes)

### UC-CONTENT-03: Delete Page
**Actor:** Admin, Manager (with content:delete permission)
**Preconditions:** Page exists; if published, must unpublish first
**Flow:**
1. Actor requests page deletion
2. System checks page is not published (if published → error)
3. System soft-deletes page (sets deleted_at)
4. Response: 204 No Content

**Exceptions:**
- Page is published → 409 Conflict (must unpublish first)
- Page not found → 404 Not Found

### UC-CONTENT-04: Publish/Unpublish Page
**Actor:** Admin, Manager, Employee (with content:publish permission)
**Preconditions:** Page exists, not deleted
**Flow (Publish):**
1. Actor requests publish
2. System sets is_published=true, published_at=now (if first publish)
3. System clears scheduled_at (if was scheduled)
4. System publishes `PagePublished` event
5. Response: 200 OK

**Flow (Unpublish):**
1. Actor requests unpublish
2. System sets is_published=false
3. System publishes `PageUnpublished` event
4. Response: 200 OK

### UC-CONTENT-05: Schedule Page Publishing
**Actor:** Admin, Manager
**Preconditions:** Page exists, not deleted, not already published
**Flow:**
1. Actor submits scheduled_at timestamp (future time)
2. System validates timestamp is in the future
3. System sets scheduled_at
4. System enqueues BullMQ delayed job with jobId
5. System publishes `PageScheduled` event
6. On scheduled time: BullMQ job fires → system publishes page
7. Response: 200 OK

**Exceptions:**
- Timestamp in the past → 422 Unprocessable Entity
- Page already published → 409 Conflict

### UC-CONTENT-06: View Page Version History
**Actor:** Admin, Manager, Employee
**Preconditions:** Page exists
**Flow:**
1. Actor requests version history for page
2. System returns paginated list of PageVersion records (desc by version)
3. Response: 200 OK with versions array [{ version, change_summary, created_by, created_at }]

### UC-CONTENT-07: Restore Page Version
**Actor:** Admin, Manager
**Preconditions:** Page exists, target version exists
**Flow:**
1. Actor requests rollback to version N
2. System fetches PageVersion snapshot for version N
3. System restores page fields from snapshot
4. System increments version (creates new version with rollback info)
5. System creates new PageVersion snapshot
6. Response: 200 OK

**Exceptions:**
- Version not found → 404 Not Found

### UC-CONTENT-08: Upload Media
**Actor:** Admin, Manager, Employee (with media:create permission)
**Preconditions:** Authenticated, valid file
**Flow:**
1. Actor uploads file(s) via multipart/form-data
2. System validates file type (allowlist: image/*, application/pdf, video/*, max 50MB)
3. System uploads file to storage (S3/MinIO)
4. System generates thumbnail if image
5. System creates Media record
6. System publishes `MediaUploaded` event
7. Response: 201 Created with media data

**Exceptions:**
- Invalid file type → 422 Unprocessable Entity
- File too large → 413 Payload Too Large
- Upload failure → 500 Internal Server Error

### UC-CONTENT-09: Delete Media
**Actor:** Admin, Manager
**Preconditions:** Media exists, not referenced by any published page
**Flow:**
1. Actor requests media deletion
2. System checks media is not referenced by any page (content_ar/content_en JSONB contains media reference)
3. System soft-deletes media record
4. System publishes `MediaDeleted` event
5. Storage cleanup happens asynchronously (event consumer)
6. Response: 204 No Content

**Exceptions:**
- Media referenced by pages → 409 Conflict
- Media not found → 404 Not Found

### UC-CONTENT-10: CRUD Blog Posts
**Actor:** Admin, Manager, Employee (with content:create/update/delete permission)
**Preconditions:** Authenticated
**Flow (Create):**
1. Actor submits blog post data (title_ar, slug, content_ar, category_id, tags, etc.)
2. System validates, checks slug uniqueness
3. System creates BlogPost with version=1, is_published=false
4. Response: 201 Created

**Flow (Update):** Same as page edit (version increment)
**Flow (Delete):** Soft-delete, same as page delete rules (unpublish first if published)

**Flow (Publish):**
1. Actor publishes blog post
2. System sets is_published=true, published_at=now
3. System publishes `BlogPostPublished` event
4. Response: 200 OK

### UC-CONTENT-11: Manage Blog Categories
**Actor:** Admin, Manager
**Preconditions:** Authenticated
**Flow:**
1. CRUD operations on blog_categories
2. Slug uniqueness enforced
3. Nested categories supported via parent_id
4. Response: 200/201/204 accordingly

### UC-CONTENT-12: Manage Menus
**Actor:** Admin, Manager
**Preconditions:** Authenticated
**Flow:**
1. Actor submits/updates menu with items JSONB tree
2. System validates items structure (recursive validation)
3. System validates URLs, page_ids reference existing pages
4. System updates menu
5. System publishes `MenuUpdated` event
6. Response: 200 OK

**Exceptions:**
- Invalid JSONB structure → 422 Unprocessable Entity
- Referenced page_id not found → 400 Bad Request

### UC-CONTENT-13: Generate Sitemap
**Actor:** System (automated)
**Preconditions:** None
**Flow:**
1. System queried for sitemap.xml
2. System aggregates all published pages (is_published=true, not deleted) and published blog posts
3. System generates XML sitemap with lastmod, changefreq, priority
4. Response: 200 OK (XML content-type)

### UC-CONTENT-14: SEO Metadata Management
**Actor:** Admin, Manager, Employee
**Preconditions:** Page or blog post exists
**Flow:**
1. Actor updates meta_title and meta_description on page/blog post
2. System validates length constraints (meta_title max 160, meta_description max 320)
3. System updates records
4. Response: 200 OK

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| POST | /api/v1/pages | Required | Admin, Manager, Employee | Create new page |
| GET | /api/v1/pages | Required | Admin, Manager, Employee | List pages (paginated, filterable) |
| GET | /api/v1/pages/{id} | Required | Admin, Manager, Employee | Get page by ID |
| PATCH | /api/v1/pages/{id} | Required | Admin, Manager, Employee | Update page |
| DELETE | /api/v1/pages/{id} | Required | Admin, Manager | Soft-delete page |
| POST | /api/v1/pages/{id}/publish | Required | Admin, Manager, Employee | Publish page |
| POST | /api/v1/pages/{id}/unpublish | Required | Admin, Manager, Employee | Unpublish page |
| POST | /api/v1/pages/{id}/schedule | Required | Admin, Manager | Schedule page publishing |
| GET | /api/v1/pages/{id}/versions | Required | Admin, Manager, Employee | Get version history |
| GET | /api/v1/pages/{id}/versions/{version} | Required | Admin, Manager | Get specific version snapshot |
| POST | /api/v1/pages/{id}/versions/{version}/restore | Required | Admin, Manager | Restore page to version |
| POST | /api/v1/media | Required | Admin, Manager, Employee | Upload media file(s) |
| GET | /api/v1/media | Required | Admin, Manager, Employee | List media (paginated, filterable) |
| GET | /api/v1/media/{id} | Required | Admin, Manager, Employee | Get media details |
| DELETE | /api/v1/media/{id} | Required | Admin, Manager | Delete media |
| POST | /api/v1/blog | Required | Admin, Manager, Employee | Create blog post |
| GET | /api/v1/blog | Public (published only) | — | List blog posts (public: published only; auth: all) |
| GET | /api/v1/blog/{id} | Public (published only) | — | Get blog post by ID |
| PATCH | /api/v1/blog/{id} | Required | Admin, Manager, Employee | Update blog post |
| DELETE | /api/v1/blog/{id} | Required | Admin, Manager | Soft-delete blog post |
| POST | /api/v1/blog/{id}/publish | Required | Admin, Manager, Employee | Publish blog post |
| POST | /api/v1/blog/categories | Required | Admin, Manager | Create blog category |
| GET | /api/v1/blog/categories | Public | — | List blog categories |
| GET | /api/v1/blog/categories/{id} | Public | — | Get blog category by ID |
| PATCH | /api/v1/blog/categories/{id} | Required | Admin, Manager | Update blog category |
| DELETE | /api/v1/blog/categories/{id} | Required | Admin, Manager | Delete blog category |
| POST | /api/v1/menus | Required | Admin, Manager | Create menu |
| GET | /api/v1/menus | Public | — | List menus (filter by location) |
| GET | /api/v1/menus/{id} | Public | — | Get menu by ID |
| PATCH | /api/v1/menus/{id} | Required | Admin, Manager | Update menu (items) |
| DELETE | /api/v1/menus/{id} | Required | Admin, Manager | Delete menu |
| GET | /api/v1/sitemap.xml | Public | — | Auto-generated XML sitemap |

### Request/Response Schemas

**POST /api/v1/pages — Request:**
```json
{
  "title_ar": "string (1-255, required)",
  "title_en": "string (1-255, optional)",
  "slug": "string (URL-safe, unique, required)",
  "content_ar": { "type": "doc", "content": [] },
  "content_en": { "type": "doc", "content": [] },
  "meta_title": "string (max 160, optional)",
  "meta_description": "string (max 320, optional)"
}
```

**POST /api/v1/pages/{id}/schedule — Request:**
```json
{
  "scheduled_at": "ISO8601 timestamp (must be in future)"
}
```

**POST /api/v1/media — Request:** multipart/form-data
```
files: File[] (max 10 files, each max 50MB)
folder: string (optional)
alt_text_ar: string (optional)
alt_text_en: string (optional)
```

**POST /api/v1/media — Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "filename": "string",
      "original_name": "string",
      "mime_type": "string",
      "size_bytes": 12345,
      "url": "string",
      "thumbnail_url": "string|null",
      "alt_text_ar": "string",
      "alt_text_en": "string"
    }
  ],
  "meta": {
    "total": 1,
    "timestamp": "ISO8601"
  }
}
```

**POST /api/v1/blog — Request:**
```json
{
  "title_ar": "string (1-255, required)",
  "title_en": "string (1-255, optional)",
  "slug": "string (URL-safe, unique, required)",
  "content_ar": { "type": "doc", "content": [] },
  "content_en": { "type": "doc", "content": [] },
  "excerpt_ar": "string (max 500, optional)",
  "excerpt_en": "string (max 500, optional)",
  "featured_image": "uuid (media ID, optional)",
  "tags": ["string"],
  "category_id": "uuid (optional)",
  "meta_title": "string (max 160, optional)",
  "meta_description": "string (max 320, optional)"
}
```

**PATCH /api/v1/menus/{id} — Request:**
```json
{
  "name": "string (optional)",
  "location": "header|footer|sidebar|custom (optional)",
  "items": [
    {
      "id": "uuid",
      "label_ar": "string",
      "label_en": "string",
      "url": "string",
      "type": "internal|external|page_link",
      "page_id": "uuid|null",
      "icon": "string|null",
      "open_in_new_tab": false,
      "sort_order": 0,
      "children": []
    }
  ]
}
```

**Error Response Envelope:**
```json
{
  "error": {
    "code": "CONTENT_SLUG_CONFLICT",
    "message": "المسار slug مستخدم من قبل صفحة أخرى",
    "message_en": "This slug is already in use by another page",
    "statusCode": 409,
    "details": {
      "slug": "about-us",
      "conflicting_page_id": "uuid"
    }
  },
  "meta": {
    "timestamp": "ISO8601",
    "requestId": "uuid"
  }
}
```

---

## 6. Business Rules

1. **RB-CONTENT-01:** Slug must be unique per content type (pages, blog posts, categories)
2. **RB-CONTENT-02:** Published pages cannot be deleted; must unpublish first
3. **RB-CONTENT-03:** Media referenced by any published page or blog post cannot be deleted; remove references first
4. **RB-CONTENT-04:** Each edit to a page or blog post increments the version counter and creates a PageVersion snapshot
5. **RB-CONTENT-05:** Scheduled publishing uses BullMQ delayed jobs (ADR-009); schedule can be cleared or rescheduled
6. **RB-CONTENT-06:** Content stored as JSONB using TipTap/Slate schema; server validates document structure on save
7. **RB-CONTENT-07:** Allowed media file types: image/*, application/pdf, video/mp4, video/webm; max 50MB per file; max 10 files per upload
8. **RB-CONTENT-08:** Menu items JSONB must be a valid recursive tree with no circular references
9. **RB-CONTENT-09:** Sitemap auto-generated; includes only published pages and blog posts (is_published=true, deleted_at IS NULL)
10. **RB-CONTENT-10:** Version snapshots store full page/blog post state at time of version creation
11. **RB-CONTENT-11:** Public API endpoints for blog and menus return only published content
12. **RB-CONTENT-12:** SEO metadata fields (meta_title, meta_description) have character limits: 160 and 320 respectively

---

## 7. Security

### RBAC Matrix — Content Domain

| Resource | Admin | Manager | Employee | Customer | Partner |
|:---|:---|:---|:---|:---|:---|
| pages | CRUD + Publish + Schedule | CRUD + Publish | CRUD (assigned) + Read | Read (published) | Read (published) |
| versions | Read + Restore | Read + Restore | Read | — | — |
| media | CRUD | CRUD | Create, Read | — | — |
| blog | CRUD + Publish | CRUD + Publish | CRUD (assigned) | Read (published) | Read (published) |
| categories | CRUD | CRUD | Read | Read | Read |
| menus | CRUD | CRUD | Read | — | — |
| sitemap | Read | Read | Read | Read | Read |

### Authorization Model
- Employee access scoped to content they created or are assigned to
- Public endpoints (published blog, menus, sitemap) require no authentication
- All mutation endpoints require valid JWT with appropriate role and permissions
- Media uploads authenticated; public media accessible via CDN/signed URLs

### Rate Limiting
- Admin API: 100 requests/minute/user
- Media upload: 30 requests/minute/user
- Public endpoints: 60 requests/minute/IP

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. Admin creates page → view in page list → publish page → page visible on public site
2. Employee uploads image → image appears in media library → insert into page content → page renders with image
3. Manager creates blog post with category and tags → publish → post appears on blog listing
4. Admin schedules page for future publish → at scheduled time → page auto-publishes via BullMQ
5. Admin edits page 3 times → version 4 created → view version history → restore to version 2 → page reverts
6. Admin creates header menu with nested items → save → GET menu returns valid tree

**Edge Cases:**
7. Create page with non-unique slug → 409 Conflict
8. Delete published page without unpublishing → 409 Conflict
9. Upload file larger than 50MB → 413 Payload Too Large
10. Delete media that is referenced in page content → 409 Conflict
11. Schedule page with past timestamp → 422 Unprocessable Entity
12. Public GET blog returns only published posts; unpublished posts excluded
13. PATCH menu with circular reference in items → 422 Validation Error
14. Restore page version after current version has been published → restore succeeds, version increments

**Error Cases:**
15. Unauthenticated POST /api/v1/pages → 401 Unauthorized
16. Customer tries to create page → 403 Forbidden
17. Employee tries to delete page they didn't create → 403 Forbidden (scoped access)
18. GET soft-deleted page → 410 Gone
19. POST /api/v1/media with non-image file claiming image/* MIME → validate magic bytes → 422
20. PATCH page with empty title_ar → 422 Validation Error

**Security Cases:**
21. XSS prevention: content JSONB sanitized on save (strip script tags, dangerous attributes)
22. Path traversal prevention in media filenames
23. CSRF protection on all mutation endpoints
24. Rate limiting on upload endpoint to prevent abuse
