# AranyaValue — Complete Product & Development Specification

## Master Build Instructions for AI Coding Agents

**Project:** AranyaValue  
**Product category:** Forest-based bioeconomy, NTFP quality intelligence, traceability and market access  
**Initial geography:** West Bengal, India  
**Expansion vision:** Pan-India  
**Primary users:** Forest-produce collectors, SHGs, cooperatives, collection centres, buyers, processors and administrators  
**Development objective:** Build a complete, functional, responsive web application that can be demonstrated at a hackathon and extended into a production-ready platform.

---

# 1. Instructions to the Coding Agent

Act as a senior full-stack engineer, product architect, UI/UX designer, AI engineer and database architect.

Your responsibility is to build AranyaValue as a complete web application, not merely a landing page or static dashboard.

Implement the entire application in one cohesive build. Do not stop after creating the homepage or propose a phased development plan instead of implementing the requested features.

You must:

1. Inspect the existing repository before making changes.
2. Preserve existing working functionality where possible.
3. Use the existing framework and dependencies if the project is already configured.
4. Implement all major pages, routes, reusable components, database models, forms, navigation and workflows.
5. Make the application functional with realistic demo data.
6. Ensure every major button, form, filter, navigation item and dashboard action performs its intended function.
7. Provide a coherent responsive experience for desktop, tablet and mobile.
8. Include loading, empty, error, success and validation states.
9. Keep the architecture modular and suitable for adding additional Indian states.
10. Clearly distinguish verified information, user-entered data, demo data and AI-generated suggestions.

Do not fabricate real-world users, partnerships, certifications, laboratory results, government approvals or market prices.

If external APIs, credentials, laboratory integrations or blockchain infrastructure are unavailable, implement a functional local alternative and clearly label it as a demo or simulated integration.

The application should work locally without requiring paid APIs.

---

# 2. Product Vision

AranyaValue is a forest-produce intelligence platform designed to help forest-dependent communities obtain better market access and make more informed decisions about product quality, storage, processing and selling.

The platform connects:

- Forest-produce collectors
- Self-help groups and cooperatives
- Community collection centres
- Buyers and processors
- Quality inspectors and laboratories
- Government schemes and institutional support

The central product idea is the **NTFP Quality-to-Price Passport**.

Each produce batch receives a digital record containing its collection information, quality measurements, storage history, verification evidence, buyer requirements and available price offers.

AranyaValue uses this information to help users understand:

- What quality information is available for their batch.
- Which buyer requirements the batch meets or does not meet.
- Why different buyers may offer different prices.
- What measurable quality improvements could make the batch more suitable for a buyer.
- How the batch has moved through the supply chain.

The application should not simply display a quality score or recommend a selling price without evidence.

Its recommendations must be explainable and linked to recorded data.

---

# 3. Problem Statement

Forest-produce collectors often have limited access to reliable information about product quality, handling requirements, buyer specifications and market prices.

Quality-related value loss can occur because of:

- Improper drying.
- Inadequate storage.
- Moisture or contamination issues.
- Poor grading.
- Incomplete quality records.
- Limited access to testing facilities.
- Different buyer specifications.
- Limited bargaining power.
- Lack of documented rejection reasons.
- Difficulty finding suitable buyers.

The platform must help address these issues through a transparent digital workflow.

## Core problem

A collector may possess a batch of forest produce but lack sufficient evidence to demonstrate its quality and understand which buyer is most suitable.

AranyaValue turns available batch evidence into actionable market information.

---

# 4. Product Differentiation

AranyaValue must not be implemented as a generic e-commerce website.

The following capabilities define its differentiation:

### 4.1 Quality-to-Price Intelligence

Connect batch quality measurements with buyer requirements and available offers.

### 4.2 Digital Quality Passport

Maintain a structured, traceable record for every produce batch.

### 4.3 Explainable Quality Guidance

Explain which recorded quality factors affect buyer suitability and what measurable improvements may help.

### 4.4 Multi-Product NTFP Support

Support honey, mahua flowers, medicinal plants, sal leaves and other forest produce through configurable product-specific quality profiles.

### 4.5 Community Collection Centre Management

Support inventory, batch intake, quality checks, processing and dispatch at community-level collection centres.

### 4.6 Government Scheme Discovery

Provide a searchable directory of relevant government schemes, eligibility information, required documents and official application links.

### 4.7 Pan-India-Ready Architecture

Build a shared national platform with configurable state-specific data, languages, products, schemes and regulations.

---

# 5. Initial Geographic Scope

The first pilot should focus on West Bengal.

The application must be designed to support additional states without requiring a complete rebuild.

## Initial demonstration locations

Use configurable demo records for:

- Purulia
- Bankura
- Jhargram
- Other relevant West Bengal districts

Do not imply that AranyaValue currently operates in these locations.

## Initial demonstration products

Include:

1. Mahua flowers
2. Forest honey
3. Sal leaves
4. Medicinal plants

The application should allow administrators to add additional products without modifying the core application code.

## Regional data requirements

Every region-specific record should support:

- State
- District
- Block or local administrative area
- Collection centre
- Local language
- Product catalogue
- Relevant quality profiles
- Buyer network
- Government schemes
- Applicable regulatory information

Use clearly labelled illustrative data wherever verified records are unavailable.

---

# 6. Recommended Technology Architecture

Use the following stack unless the existing repository requires an alternative.

## Frontend

- React
- TypeScript
- Vite or the existing application framework
- Tailwind CSS
- shadcn/ui or equivalent accessible component library
- React Router
- React Hook Form
- Zod validation
- Recharts for analytics

## Backend

- Node.js
- TypeScript
- Express or an existing equivalent API framework
- PostgreSQL
- Prisma ORM

## Authentication

Implement role-based authentication.

For local development, provide demo login accounts for each user role.

## File storage

Use local development storage or a configurable object-storage adapter for:

- Batch photographs
- Laboratory reports
- Quality certificates
- Supporting documents
- Government scheme documents

## AI services

Create a modular AI service layer.

The system should support:

- Quality-record explanation.
- Buyer-requirement comparison.
- Quality-improvement recommendations.
- Multilingual assistance.
- Natural-language search.

Do not make the application dependent on a single paid AI provider.

Provide a deterministic fallback when an AI API is unavailable.

## Blockchain / audit architecture

Implement a tamper-evident event history.

For the hackathon version, a hash-chained audit log is acceptable.

The architecture should allow a future permissioned blockchain integration.

Do not claim that a local hash chain is a deployed public blockchain.

## Offline support

Implement offline-capable batch creation and local draft storage.

Synchronise records when connectivity returns.

Show the user whether a record is:

- Saved locally.
- Pending synchronisation.
- Successfully synchronised.
- Failed to synchronise.

---

# 7. User Roles and Permissions

Implement the following roles.

## 7.1 Collector

Can:

- Create and manage their own batches.
- Upload batch photographs.
- Record collection and storage details.
- Submit quality measurements.
- View quality guidance.
- Browse buyers and offers.
- Generate a Quality Passport.
- View their transaction history.
- Discover relevant schemes.

Cannot:

- Approve their own official verification.
- Edit another collector's private records.
- Modify verified laboratory results.

## 7.2 Collection Centre Manager

Can:

- Register incoming produce.
- Manage centre inventory.
- Create and update batch records.
- Assign quality inspections.
- Record processing and storage.
- Manage dispatch and sales.
- View centre analytics.
- Manage registered collectors associated with the centre.

## 7.3 Buyer

Can:

- Browse available batches.
- Filter batches by product, location and quality.
- View public Quality Passport information.
- Submit offers.
- Record purchase requirements.
- Compare available batches.
- Track orders and transactions.
- Record rejection reasons.

## 7.4 Quality Inspector

Can:

- Review submitted batches.
- Record inspection results.
- Upload supporting evidence.
- Verify measurement records.
- Approve or reject verification requests.
- Document rejection reasons.
- Maintain an inspection history.

## 7.5 Administrator

Can:

- Manage users and roles.
- Manage state and district configurations.
- Manage products and quality profiles.
- Manage buyers and collection centres.
- Review quality-verification requests.
- Manage government scheme records.
- View system analytics.
- Review audit logs.
- Configure AI and external integrations.

---

# 8. Application Routes and Page Structure

Use a clear route structure.

The following routes are required.

## Public routes

| Route | Page |
|---|---|
| `/` | Landing page |
| `/about` | About AranyaValue |
| `/how-it-works` | Platform workflow |
| `/marketplace` | Public NTFP marketplace |
| `/marketplace/:batchId` | Public batch details |
| `/passport/:batchId` | Public Quality Passport |
| `/schemes` | Government scheme directory |
| `/schemes/:schemeId` | Scheme details |
| `/products` | Supported NTFP catalogue |
| `/products/:productId` | Product details |
| `/contact` | Contact and support |
| `/login` | Login |
| `/register` | Registration |

## Collector routes

| Route | Page |
|---|---|
| `/collector/dashboard` | Collector dashboard |
| `/collector/batches` | My batches |
| `/collector/batches/new` | Create batch |
| `/collector/batches/:batchId` | Batch details |
| `/collector/batches/:batchId/edit` | Edit draft batch |
| `/collector/passports` | My Quality Passports |
| `/collector/buyers` | Buyer discovery |
| `/collector/offers` | Buyer offers |
| `/collector/schemes` | Relevant schemes |
| `/collector/assistant` | AI assistant |
| `/collector/profile` | Profile and preferences |

## Collection centre routes

| Route | Page |
|---|---|
| `/centre/dashboard` | Centre dashboard |
| `/centre/collectors` | Registered collectors |
| `/centre/inventory` | Inventory management |
| `/centre/batches` | Centre batches |
| `/centre/quality-checks` | Quality inspections |
| `/centre/processing` | Processing and storage |
| `/centre/orders` | Orders and dispatch |
| `/centre/analytics` | Centre analytics |
| `/centre/settings` | Centre configuration |

## Buyer routes

| Route | Page |
|---|---|
| `/buyer/dashboard` | Buyer dashboard |
| `/buyer/marketplace` | Batch discovery |
| `/buyer/requirements` | Buyer specifications |
| `/buyer/requirements/new` | Create specification |
| `/buyer/offers` | Submitted offers |
| `/buyer/orders` | Orders |
| `/buyer/orders/:orderId` | Order details |
| `/buyer/transactions` | Transaction history |
| `/buyer/profile` | Buyer profile |

## Inspector routes

| Route | Page |
|---|---|
| `/inspector/dashboard` | Inspection dashboard |
| `/inspector/queue` | Verification queue |
| `/inspector/batches/:batchId` | Inspect batch |
| `/inspector/history` | Inspection history |

## Administrator routes

| Route | Page |
|---|---|
| `/admin/dashboard` | Administration dashboard |
| `/admin/users` | User management |
| `/admin/products` | NTFP catalogue |
| `/admin/quality-profiles` | Quality profiles |
| `/admin/states` | State configuration |
| `/admin/districts` | District management |
| `/admin/centres` | Collection centres |
| `/admin/buyers` | Buyer management |
| `/admin/schemes` | Scheme management |
| `/admin/audit-logs` | Audit history |
| `/admin/settings` | Platform settings |

---

# 9. Landing Page Specification

The landing page must communicate the product clearly within the first few seconds.

## Header

Include:

- AranyaValue logo
- Home
- How It Works
- Marketplace
- Government Schemes
- About
- Language selector
- Login
- Get Started

## Hero section

Headline:

**Better Quality. Fairer Value. Stronger Forest Communities.**

Supporting text:

AranyaValue helps forest-produce collectors document quality, understand buyer requirements and discover better market opportunities through a transparent digital Quality Passport.

Primary CTA: Create a Quality Passport

Secondary CTA: Explore Marketplace

Include a product dashboard preview or Quality Passport visual.

## Problem section

Show the challenges faced by forest-produce collectors:

- Limited quality documentation.
- Inconsistent handling and storage.
- Limited access to buyer specifications.
- Unclear price differences.
- Difficult market discovery.

## Solution section

Present four main capabilities:

1. Quality Passport
2. Quality-to-Price Intelligence
3. Buyer Discovery
4. Government Scheme Discovery

## How it works

Show a five-step workflow:

1. Register produce batch.
2. Record collection and quality evidence.
3. Verify applicable quality criteria.
4. Compare buyer requirements and offers.
5. Improve, sell and maintain traceability.

## Regional relevance

Show West Bengal as the initial pilot region.

Use verified regional produce examples.

Clearly label the geographic coverage as a pilot or proposed implementation.

## Footer

Include:

- About
- Contact
- Privacy
- Terms
- Data and verification disclaimer
- Official government resource links

---

# 10. Collector Dashboard

The collector dashboard should be simple enough for first-time users.

## Summary cards

- Total batches
- Pending verification
- Verified batches
- Available buyer offers
- Active orders
- Estimated inventory value

Do not label an estimate as actual income.

## Dashboard components

### Recent batches

Display:

- Batch ID
- Product
- Quantity
- Collection date
- Verification status
- Latest update

### Quality alerts

Show actionable messages such as:

"Moisture measurement is missing. Add a valid measurement to complete the quality assessment."

### Buyer opportunities

Show buyers whose recorded requirements match the batch.

### Recommended actions

Show the next useful action for each batch.

### Recent transactions

Show completed and pending sales.

---

# 11. Batch Creation Workflow

The batch creation workflow is one of the most important features.

Build it as a guided, multi-step form.

## Step 1: Product information

Fields:

- Product
- Local product name
- Product category
- Variety or species, where applicable
- Quantity
- Unit
- Collection date
- Collection location
- Collection method
- Collector
- Collection centre

## Step 2: Collection and source information

Fields:

- Source type
- Collection location
- Collection date
- Source declaration
- Supporting documents
- Collection notes

Do not automatically certify the legal origin of a product based only on a user declaration.

## Step 3: Handling and storage

Fields:

- Drying method
- Drying start date
- Drying completion date
- Storage method
- Storage location
- Storage start date
- Relevant environmental measurements
- Packaging details
- Handling notes

## Step 4: Quality measurements

Display only parameters relevant to the selected product's quality profile.

Examples:

- Moisture
- Foreign matter
- Product condition
- Grade
- Relevant laboratory results

Every measurement must include:

- Value
- Unit
- Measurement date
- Measurement method
- Evidence source
- Optional supporting document

## Step 5: Evidence upload

Allow:

- Product photographs
- Measurement photographs
- Laboratory reports
- Inspection documents
- Supporting certificates

## Step 6: Review and submission

Show a complete batch summary.

Allow the user to save a draft or submit for verification.

After submission, generate a unique batch identifier.

---

# 12. Quality Verification Engine

This is the core scientific component.

## Important rule

Never assign a definitive quality grade based only on an AI-generated score or product photograph.

Quality verification must be based on relevant measurements, applicable specifications and available evidence.

## Product-specific quality profiles

Each product must have a configurable quality profile.

Example:

```ts
interface QualityProfile {
  id: string;
  productId: string;
  name: string;
  version: string;
  applicableRegion?: string;
  parameters: QualityParameter[];
  sourceName?: string;
  sourceUrl?: string;
  effectiveDate?: string;
}
```

Each parameter should support:

- Parameter name
- Measurement unit
- Minimum acceptable value
- Maximum acceptable value
- Required or optional status
- Measurement method
- Applicable product grade
- Reference source
- Effective date

## Verification statuses

Implement:

- Draft
- Submitted
- Pending verification
- Verified
- Verified with limitations
- Failed checks
- Rejected
- Expired

## Verification logic

1. Identify the product.
2. Load its applicable quality profile.
3. Validate the submitted measurements.
4. Identify missing evidence.
5. Compare measurements against applicable criteria.
6. Generate a transparent result.
7. Store the verifier and verification timestamp.
8. Preserve the record in the audit history.

## Verification result

The result should show:

- Parameters checked
- Recorded values
- Applicable thresholds
- Pass/fail status for each parameter
- Missing information
- Verification limitations
- Evidence sources
- Verifier information

A batch must not be marked fully verified if required measurements are missing.

---

# 13. Digital Quality Passport

Every batch should have a unique digital Quality Passport.

## Passport information

### Batch identity

- Batch ID
- Product
- Quantity
- Collection date
- Collection location
- Collector or collection centre

### Quality information

- Recorded measurements
- Applicable quality profile
- Grade, where supported
- Verification status
- Inspection date
- Verifier information

### Handling history

- Drying records
- Storage records
- Processing events
- Packaging records

### Evidence

- Photographs
- Laboratory reports
- Inspection documents
- Measurement records

### Market information

- Buyer requirements
- Available offers
- Price comparison
- Rejection history

### Traceability

- Batch creation event
- Verification events
- Processing events
- Ownership or custody changes
- Dispatch events
- Transaction events

## QR functionality

Generate a QR code that opens the public Quality Passport.

The public view must expose only approved information.

Private collector information, internal documents and personal data must not be publicly accessible.

---

# 14. Quality-to-Price Intelligence Engine

This is the most important differentiating feature.

## Purpose

Explain how recorded batch quality and buyer requirements relate to available price offers.

Do not generate unsupported market prices.

## Buyer requirement model

Each buyer specification should include:

- Buyer
- Product
- Required grade
- Minimum quantity
- Maximum quantity, where applicable
- Required measurements
- Acceptable measurement ranges
- Packaging requirements
- Storage requirements
- Required documents
- Offer price
- Price unit
- Offer date
- Offer expiry
- Delivery conditions

## Buyer matching

The system should compare batch attributes with buyer requirements.

Display:

- Suitable buyers
- Requirements met
- Requirements not met
- Missing measurements
- Quantity compatibility
- Available offer price
- Offer validity

## Price comparison

Normalize offers to comparable units wherever possible.

For example:

- ₹ per kg
- ₹ per litre
- ₹ per piece

Display the original offer and the normalized value.

Never compare offers without accounting for units and relevant delivery conditions.

## Price explanation

Provide a structured explanation:

- Which batch measurements affect buyer suitability.
- Which buyer requirements are satisfied.
- Which requirements remain unmet.
- Which recorded factors may explain a lower offer.
- Which measurable improvement could make the batch suitable for another buyer.

## Example

A buyer requires moisture below a specified threshold.

The batch has a recorded moisture measurement above that threshold.

The application should explain:

"The recorded moisture value exceeds this buyer's stated requirement. This batch does not currently meet the moisture criterion. A new valid measurement after appropriate drying may be needed before reassessment."

Do not claim that drying will definitely increase the selling price.

---

# 15. AI Quality Assistant

Create a multilingual assistant that helps users understand their batch records.

## Supported tasks

- Explain quality measurements.
- Explain buyer requirements.
- Explain verification status.
- Suggest what information is missing.
- Provide general product-handling guidance.
- Explain relevant government schemes.
- Help users navigate the application.

## Response requirements

Every quality-related recommendation should identify:

- The relevant recorded data.
- The applicable criterion.
- The reason for the recommendation.
- The next measurable action.
- Any uncertainty or limitation.

The assistant must not:

- Invent laboratory results.
- Certify product quality.
- Guarantee a selling price.
- Invent government scheme eligibility.
- Provide unsupported medicinal claims.
- Recommend unsafe handling or processing.

## Fallback mode

If no AI provider is configured, use deterministic rule-based guidance.

Clearly identify deterministic guidance as application-generated guidance rather than a live AI response.

---

# 16. Marketplace

The marketplace should focus on suitable buyer-product matching.

## Public marketplace

Display:

- Product
- Quantity
- Region
- Quality status
- Available evidence
- Verification date
- Buyer requirements, where appropriate

## Filters

- State
- District
- Product
- Quantity
- Verification status
- Quality grade
- Collection centre

## Batch details

Include:

- Product description
- Batch quantity
- Quality Passport
- Handling history
- Available documents
- Buyer enquiry option

## Buyer enquiries

Allow a buyer to:

- Submit an enquiry.
- Request additional evidence.
- Submit an offer.
- Record an intended purchase.

Do not treat an enquiry as a completed sale.

---

# 17. Buyer Dashboard

The buyer dashboard should support procurement decisions.

## Summary cards

- Active requirements
- Suitable batches
- Pending enquiries
- Submitted offers
- Active orders
- Completed purchases

## Buyer requirements

Allow buyers to create and manage product-specific specifications.

## Suitable batches

Show matching batches and explain:

- Which requirements are satisfied.
- Which requirements are not satisfied.
- Which measurements are missing.

## Offer management

Allow buyers to:

- Create offers.
- Update offers.
- Set expiry dates.
- Accept or withdraw offers.
- View collector responses.

## Orders

Track:

- Order status
- Batch ID
- Quantity
- Agreed price
- Delivery status
- Payment status

---

# 18. Community Collection Centre Management

Collection centres are an important part of the platform's long-term operating model.

## Centre dashboard

Show:

- Total incoming batches
- Available inventory
- Pending quality checks
- Processing batches
- Ready-to-dispatch batches
- Completed sales

## Collector management

Allow centres to register collectors and associate batches with them.

## Inventory

Track:

- Product
- Batch
- Quantity
- Unit
- Storage location
- Current status
- Last updated

## Processing

Record:

- Processing method
- Input quantity
- Output quantity
- Processing date
- Responsible operator
- Quality measurements after processing

## Dispatch

Record:

- Buyer
- Order
- Batch
- Quantity
- Dispatch date
- Delivery status

---

# 19. Government Scheme Discovery

Build a searchable scheme directory.

## Scheme fields

- Scheme name
- Government department
- Central or state scheme
- State applicability
- Eligible beneficiaries
- Benefits
- Eligibility criteria
- Required documents
- Application process
- Official application link
- Source URL
- Last verified date

## Features

- Search
- Filter by state
- Filter by beneficiary type
- Filter by category
- View scheme details
- Save relevant schemes
- Mark schemes as applied for
- View application checklist

## Important

Do not fabricate scheme details or application links.

Use official government sources wherever possible.

If the scheme data is illustrative, label it clearly.

---

# 20. Pan-India Architecture

Build the application around a shared core and configurable state-specific data.

## Shared core

- Authentication
- User management
- Batch management
- Quality Passport
- Verification engine
- Marketplace
- Buyer requirements
- Offers
- Orders
- Audit logs
- AI services

## State-specific configuration

- State
- Districts
- Languages
- NTFP catalogue
- Quality profiles
- Government schemes
- Relevant regulatory information
- Buyer network
- Collection centres

## Required behaviour

Adding a new state should primarily involve adding configuration and data.

The application should not require a separate codebase for every state.

## State selector

Allow users to select their state and district.

Use the selected state to filter:

- Products
- Schemes
- Buyers
- Collection centres
- Regional information

---

# 21. Database Model

Use a relational database.

The following entities should be implemented.

## User

```ts
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  preferredLanguage: string;
  stateId?: string;
  districtId?: string;
  createdAt: Date;
}
```

## State

```ts
interface State {
  id: string;
  name: string;
  code: string;
  supportedLanguages: string[];
  isActive: boolean;
}
```

## District

```ts
interface District {
  id: string;
  stateId: string;
  name: string;
  isActive: boolean;
}
```

## Product

```ts
interface Product {
  id: string;
  name: string;
  localNames: Record<string, string>;
  category: string;
  speciesName?: string;
  description?: string;
  stateAvailability: string[];
  isActive: boolean;
}
```

## Batch

```ts
interface Batch {
  id: string;
  batchCode: string;
  productId: string;
  collectorId: string;
  collectionCentreId?: string;
  stateId: string;
  districtId: string;
  collectionDate: Date;
  quantity: number;
  unit: string;
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

## QualityMeasurement

```ts
interface QualityMeasurement {
  id: string;
  batchId: string;
  parameterId: string;
  value: number;
  unit: string;
  measuredAt: Date;
  method?: string;
  evidenceId?: string;
  recordedBy: string;
}
```

## QualityProfile

```ts
interface QualityProfile {
  id: string;
  productId: string;
  version: string;
  sourceUrl?: string;
  effectiveDate?: Date;
  parameters: QualityParameter[];
}
```

## QualityVerification

```ts
interface QualityVerification {
  id: string;
  batchId: string;
  inspectorId?: string;
  status: VerificationStatus;
  resultSummary?: string;
  verifiedAt?: Date;
  evidenceIds: string[];
}
```

## Buyer

```ts
interface Buyer {
  id: string;
  userId: string;
  businessName: string;
  stateId: string;
  districtId?: string;
  businessType?: string;
}
```

## BuyerRequirement

```ts
interface BuyerRequirement {
  id: string;
  buyerId: string;
  productId: string;
  quantity: number;
  unit: string;
  specifications: Record<string, unknown>;
  requiredDocuments: string[];
  createdAt: Date;
}
```

## Offer

```ts
interface Offer {
  id: string;
  buyerId: string;
  batchId: string;
  quantity: number;
  unit: string;
  price: number;
  currency: string;
  validUntil?: Date;
  status: string;
}
```

## Order

```ts
interface Order {
  id: string;
  buyerId: string;
  batchId: string;
  quantity: number;
  unit: string;
  agreedPrice: number;
  status: string;
  createdAt: Date;
}
```

## AuditEvent

```ts
interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actorId: string;
  payload: Record<string, unknown>;
  previousHash?: string;
  eventHash: string;
  createdAt: Date;
}
```

## GovernmentScheme

```ts
interface GovernmentScheme {
  id: string;
  name: string;
  department: string;
  stateId?: string;
  eligibility: string;
  benefits: string;
  requiredDocuments: string[];
  officialUrl: string;
  sourceUrl: string;
  lastVerifiedAt?: Date;
}
```

---

# 22. API Structure

Use a consistent REST API structure.

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Products

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products
PATCH  /api/products/:id
```

## Batches

```text
GET    /api/batches
POST   /api/batches
GET    /api/batches/:id
PATCH  /api/batches/:id
POST   /api/batches/:id/submit
POST   /api/batches/:id/evidence
```

## Quality

```text
GET  /api/quality-profiles/:productId
POST /api/batches/:id/measurements
POST /api/batches/:id/verification
GET  /api/batches/:id/verification
```

## Marketplace

```text
GET  /api/marketplace
GET  /api/marketplace/:batchId
POST /api/offers
GET  /api/offers
PATCH /api/offers/:id
```

## Buyer requirements

```text
GET  /api/buyer-requirements
POST /api/buyer-requirements
PATCH /api/buyer-requirements/:id
GET  /api/buyer-requirements/:id/matches
```

## Schemes

```text
GET  /api/schemes
GET  /api/schemes/:id
POST /api/schemes
PATCH /api/schemes/:id
```

## Collection centres

```text
GET  /api/centres
POST /api/centres
GET  /api/centres/:id/inventory
GET  /api/centres/:id/analytics
```

## AI

```text
POST /api/ai/quality-explanation
POST /api/ai/buyer-match-explanation
POST /api/ai/quality-guidance
POST /api/ai/assistant
```

---

# 23. UI/UX Design System

The design must feel like a serious, modern bioeconomy technology platform.

Avoid generic dashboard templates and excessive decorative elements.

## Brand personality

- Trustworthy
- Scientific
- Sustainable
- Practical
- Community-focused
- Professional

## Colour palette

Primary forest green: `#173F2B`

Secondary green: `#2F6B4F`

Natural sage: `#A7B88A`

Warm background: `#F7F7F2`

Surface: `#FFFFFF`

Primary text: `#17231C`

Secondary text: `#66736A`

Use red and amber only for meaningful warnings and statuses.

## Typography

Use a modern, highly readable sans-serif font.

Use clear hierarchy:

- Large page titles
- Short supporting descriptions
- Compact section headings
- Readable data tables
- Accessible form labels

## Layout

Use:

- Consistent spacing
- Responsive sidebar navigation
- Clear page headers
- Compact summary cards
- Well-structured tables
- Meaningful charts
- Contextual actions

Avoid:

- Excessive gradients
- Large decorative empty sections
- Unnecessary animations
- Oversized cards
- Fake analytics
- Decorative AI scores without evidence

---

# 24. Functional Requirements

The following must work in the completed application.

## Navigation

- Every route must load.
- Sidebar links must navigate correctly.
- Breadcrumbs must work.
- Back navigation must work.

## Forms

- Validation
- Required fields
- Inline errors
- Success feedback
- Draft saving
- Loading states

## Tables

- Search
- Sorting
- Filtering
- Pagination
- Empty states

## Dashboard

- Data should update after relevant actions.
- Charts should use actual application data.
- No fake statistics presented as real platform performance.

## Marketplace

- Filters must work.
- Buyer enquiries must be stored.
- Offers must update the correct batch.

## Quality Passport

- QR generation must work.
- Public view must respect permissions.
- Verification status must reflect actual records.

## Offline mode

- Batch drafts should persist locally.
- Synchronisation status should be visible.
- Failed synchronisation should not silently lose data.

---

# 25. Demo Data

Create realistic but clearly labelled demo data.

Include:

- 3 demo collectors
- 2 collection centres
- 3 buyers
- 4 NTFP products
- 8–12 sample batches
- Several quality measurements
- Several buyer specifications
- Multiple offers
- Sample government schemes
- Sample verification events

All demo data must be identified as illustrative.

Do not fabricate actual government partnerships, actual sales, actual laboratory results or actual operational statistics.

---

# 26. Demo Scenarios

The application must support these complete demonstrations.

## Scenario 1: Collector creates a batch

1. Log in as a collector.
2. Create a Mahua batch.
3. Add collection and storage information.
4. Record quality measurements.
5. Upload evidence.
6. Submit for verification.
7. Open the generated Quality Passport.

## Scenario 2: Inspector verifies quality

1. Log in as an inspector.
2. Open the verification queue.
3. Review the batch.
4. Check the recorded measurements.
5. Approve, reject or request additional information.
6. View the updated verification status.

## Scenario 3: Buyer compares batches

1. Log in as a buyer.
2. Create a buyer requirement.
3. Search suitable batches.
4. Compare quality requirements.
5. Review available offers.
6. Submit an offer.

## Scenario 4: Collector receives quality guidance

1. Open a batch.
2. View missing or failed measurements.
3. Read the explanation.
4. Follow the measurable improvement guidance.
5. Record new evidence.
6. Submit for reassessment.

## Scenario 5: Community centre manages inventory

1. Log in as a centre manager.
2. Register incoming produce.
3. Assign batches to storage.
4. Record processing.
5. Dispatch a batch against an order.
6. View updated inventory.

## Scenario 6: Discover a government scheme

1. Select West Bengal.
2. Browse relevant schemes.
3. Open a scheme.
4. Review eligibility and required documents.
5. Open the official application link.

---

# 27. Security and Privacy

Implement:

- Role-based access control.
- Server-side validation.
- Protected routes.
- Secure password handling.
- Private evidence storage.
- Restricted access to personal information.
- Audit logging.
- Safe file-upload validation.
- Public/private field separation.

Never expose personal collector information through public QR pages.

Do not treat a QR code as proof of certification.

---

# 28. Performance and Accessibility

The application must:

- Work on mobile devices.
- Support low-bandwidth usage.
- Avoid unnecessary large assets.
- Use lazy loading where appropriate.
- Provide accessible labels.
- Support keyboard navigation.
- Maintain sufficient colour contrast.
- Display clear error messages.
- Use responsive tables or mobile-friendly alternatives.

---

# 29. Testing Requirements

Implement tests for the most important business logic.

## Quality engine tests

Test:

- Valid measurements.
- Invalid measurements.
- Missing required parameters.
- Unit conversion.
- Grade calculation.
- Verification status transitions.

## Marketplace tests

Test:

- Buyer requirement matching.
- Offer creation.
- Offer expiry.
- Quantity compatibility.
- Price normalisation.

## Permissions tests

Test that:

- Collectors cannot modify other collectors' private records.
- Buyers cannot approve verification.
- Inspectors cannot change buyer offers.
- Public passport pages expose only approved information.

## UI tests

Test the primary demo scenarios from start to finish.

---

# 30. Definition of Done

The project is complete only when:

- All major routes exist.
- All required roles work.
- Authentication works.
- Batch creation works.
- Quality measurements can be recorded.
- Quality verification works.
- Digital Quality Passports work.
- QR codes work.
- Buyer requirements can be created.
- Buyer matching works.
- Offers can be submitted.
- Quality-to-Price explanations work.
- Collection centre inventory works.
- Government schemes can be searched.
- The application supports state-specific configuration.
- Offline batch drafts work.
- Audit history is available.
- Demo data is realistic and clearly labelled.
- The UI is responsive.
- The project runs locally.
- The README explains setup and demo accounts.

---

# 31. Final Product Principle

AranyaValue should make forest-produce quality information useful to the people who collect, process and purchase forest produce.

The central workflow is:

**Collect → Record → Verify → Understand → Compare → Improve → Sell**

The Quality Passport is the foundation.

The Quality-to-Price Intelligence Engine is the differentiator.

The marketplace, community collection centre management, government scheme discovery and pan-India architecture make the platform useful beyond a single hackathon demonstration.

Build the complete application with these principles in mind.

Do not sacrifice scientific credibility for impressive-looking AI features.

Do not claim verification without evidence.

Do not present illustrative data as real.

Prioritise a working, explainable end-to-end workflow over a large number of disconnected features.

The final result should be a credible prototype of a platform that could be piloted in West Bengal and expanded to other Indian states through a shared, configurable architecture.
