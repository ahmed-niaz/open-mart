# Agent Instructions: Single-Vendor E-Commerce DDD & Clean Architecture Rules

> **CRITICAL DIRECTIVE FOR THE AI AGENT**:
> You MUST follow the rules in this document and in [DDD_CLEAN_ARCHITECTURE_RULES.md](./DDD_CLEAN_ARCHITECTURE_RULES.md) BEFORE modifying, creating, or refactoring ANY code in this repository. Verify every action against the Pre-Implementation Checklist below.

---

## 1. Single-Vendor Context

This repository is built exclusively for a **Single-Vendor E-Commerce Store and Website** (Direct-to-Consumer / Single Merchant):
- **No Vendor Multi-Tenancy**: Products, inventory, orders, and payments belong directly to the store. Never introduce `vendor_id`, `merchant_id`, seller commissions, or vendor payout tables.
- **Unified Catalog & Checkout**: Direct cart-to-order flow with centralized stock management and a single merchant payment processor.

---

## 2. Mandatory Pre-Implementation Checklist

Before writing or editing code in any feature module (`apps/api/src/<module_name>/`), verify:

1. **4-Layer Structure**: Code must strictly belong to one of the 4 layers:
   - `domain/`: Pure business logic (`entities/`, `value-objects/`, `events/`). ZERO framework dependencies (no NestJS, no Drizzle, no HTTP).
   - `application/`: Application logic (`commands/`, `queries/`, `ports/`, `event-handlers/`, `sagas/`). Depends ONLY on `domain/` and its own ports.
   - `infrastructure/`: Technical implementations (`adapters/`). Implements ports using Drizzle ORM, Stripe, Cloudinary, etc.
   - `presentation/`: Entry points (`<module>.controller.ts`, `dto/`, `guards/`). Injects ONLY `CommandBus` and `QueryBus`.
2. **True CQRS (Read/Write Separation)**:
   - **Write Path (Commands)**: Mutate state via Domain Aggregates to enforce business invariants.
   - **Read Path (Queries)**: **BYPASS Domain Aggregates entirely.** Query handlers execute direct, fast SQL / Drizzle projections returning read-model DTOs.
3. **Optimistic Concurrency Control (OCC)**:
   - All Aggregate Roots must have `_version: number` (starting at 1) and `incrementVersion()`.
   - Repository updates must enforce atomic version matching:
     ```sql
     UPDATE table SET ..., version = :nextVersion WHERE id = :id AND version = :currentVersion
     ```
   - If 0 rows are affected, throw `ApplicationException(..., ApplicationExceptionCode.CONFLICT)`.
4. **Transactional Outbox (No Dual-Write Hazard)**:
   - Never commit domain events directly to in-memory buses or external brokers during the HTTP cycle.
   - Domain events are atomically written to an `outbox` table in the same database transaction as the aggregate state.
5. **Financial & Price Immutability**:
   - Order line items, taxes, discounts, and currency rates are frozen as immutable `PriceSnapshot` Value Objects upon checkout.
   - Never recalculate historical orders against current catalog prices. Money values use minor currency units (cents/paisa as integers).
6. **Mandatory Idempotency**:
   - Mutating payment and checkout endpoints require `X-Idempotency-Key`.
   - Webhook handlers (Stripe/SSLCommerz/etc.) must safely handle duplicate or out-of-order deliveries.
7. **Resource-Oriented Media Management**:
   - Product gallery images are managed independently. Media arrays must never be overwritten destructively during general product metadata updates.
8. **Zero Hard Deletes**:
   - Financial, order, customer, and catalog records are never hard-deleted (`DELETE FROM`). Use domain lifecycle transitions (`archive()`, `draft()`, `cancel(reason)`).
9. **Anti-Corruption Layer (ACL)**:
   - Cross-module interaction uses consumer ports and data contracts (`application/ports/`) with adapter implementations in `infrastructure/adapters/`. Never import repositories across modules.
10. **NodeNext ESM Imports**:
    - All relative TypeScript imports must end with `.js` (e.g. `import ... from './file.js';`).
11. **Standardized Exceptions**:
    - Domain invariant breaches throw `DomainException` (mapped to HTTP 400).
    - Application/concurrency conflicts throw `ApplicationException` with `ApplicationExceptionCode` (mapped to HTTP 400/404/409/500).

---

## 3. Forbidden Anti-Patterns

- ❌ **NEVER** put framework decorators (`@Injectable`, `@Entity`, etc.) inside the `domain/` layer.
- ❌ **NEVER** use Domain Aggregates for Read/Query operations.
- ❌ **NEVER** mutate state in query handlers.
- ❌ **NEVER** hard delete (`DELETE FROM`) orders, products, customers, or payments.
- ❌ **NEVER** import repositories or database schemas across module boundaries.
- ❌ **NEVER** omit the `.js` extension on relative imports.
- ❌ **NEVER** publish domain events directly to brokers during the synchronous HTTP transaction (use Transactional Outbox).
- ❌ **NEVER** wipe product media arrays during general metadata updates.

For full architectural templates, code snippets, and details, reference [DDD_CLEAN_ARCHITECTURE_RULES.md](./DDD_CLEAN_ARCHITECTURE_RULES.md).

