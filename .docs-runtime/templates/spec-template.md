# [Domain Name] Specification

## Overview
[Brief description of the domain and its purpose]

## Bounded Context
[Definition of the bounded context, its boundaries, and its relationships]

## Aggregates

### [Aggregate Name]
- **Root Entity:** [Entity name]
- **Description:** [What this aggregate represents]
- **Invariants:**
  - [Invariant 1]
  - [Invariant 2]

## Entities

### [Entity Name]
| Property | Type | Description | Constraints |
|:---|:---|:---|:---|
| id | UUID | Unique identifier | Required |
| name | String | Display name | Max 255 chars |
| ... | ... | ... | ... |

## Value Objects

### [Value Object Name]
| Property | Type | Description |
|:---|:---|:---|
| ... | ... | ... |

## Domain Events

| Event | Trigger | Payload |
|:---|:---|:---|
| [Entity]Created | When [entity] is created | { id, ... } |
| [Entity]Updated | When [entity] is modified | { id, changes } |
| [Entity]Deleted | When [entity] is deleted | { id } |

## Use Cases

### UC-[ID]: [Use Case Name]
- **Actor:** [Who performs this action]
- **Preconditions:** [What must be true before]
- **Flow:**
  1. [Step 1]
  2. [Step 2]
- **Postconditions:** [What is true after]
- **Exceptions:**
  - [Exception: handling]

## API Specification

### Endpoints

| Method | Path | Description | Auth |
|:---|:---|:---|:---|
| GET | /api/v1/[resource] | List [resources] | Required |
| POST | /api/v1/[resource] | Create [resource] | Required |
| GET | /api/v1/[resource]/{id} | Get [resource] | Required |
| PUT | /api/v1/[resource]/{id} | Update [resource] | Required |
| DELETE | /api/v1/[resource]/{id} | Delete [resource] | Admin |

### Request/Response Schemas

[OpenAPI schema references or inline definitions]

## Business Rules

1. [Rule 1]
2. [Rule 2]
3. [Rule 3]

## Validation Rules

| Field | Rule | Message |
|:---|:---|:---|
| name | Required, max 255 | "Name is required" |
| email | Required, valid email | "Valid email is required" |

## Dependencies

### Inbound
- [List of domains that depend on this one]

### Outbound
- [List of domains this one depends on]

## Security

- [Required permissions]
- [Data classification]
- [Encryption requirements]

## Testing

### Test Scenarios
1. [Happy path scenario]
2. [Edge case scenario]
3. [Error scenario]

### Test Data
- [Test data requirements]
