# Complete Developer Report - Wijha Course Marketplace Platform

**Version:** 1.0.0  
**Date:** 2024  
**Platform:** Web Application (React + Supabase)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Authentication & Security](#authentication--security)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Features & Functionalities](#features--functionalities)
8. [File Structure](#file-structure)
9. [API Integration](#api-integration)
10. [Security Implementation](#security-implementation)
11. [Development Setup](#development-setup)
12. [Deployment](#deployment)
13. [Key Workflows](#key-workflows)
14. [Future Improvements](#future-improvements)

---

## Executive Summary

**Wijha** is a comprehensive course marketplace platform built with React and Supabase. The platform enables three types of users (Students, Creators, and Administrators) to interact in a course-based educational ecosystem.

### Core Functionality
- **Students** can browse courses, enroll in courses, upload payment proofs, and access course content after approval
- **Creators** can create and manage courses, view earnings, and request payouts
- **Administrators** can approve/reject courses and enrollments, manage payouts, and oversee platform operations

### Key Characteristics
- Full-stack application with React frontend and Supabase backend
- Role-based access control (RBAC) with three user roles
- Row Level Security (RLS) for database protection
- Single-device session management
- Manual payment processing with admin approval workflow
- Comprehensive security measures (rate limiting, input sanitization, session management)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  (Vite + React 18 + React Router)                       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Pages    │  │Components│  │ Context  │             │
│  │          │  │          │  │ Providers│             │
│  └──────────┘  └──────────┘  └──────────┘             │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/HTTPS
                     │
┌────────────────────▼────────────────────────────────────┐
│              Supabase Backend                           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Auth       │  │  Database    │  │  Storage     │ │
│  │  (PKCE)      │  │  (Postgres   │  │  (Files)     │ │
│  │              │  │   + RLS)     │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Client-Side Architecture

- **Pages**: Route-based page components
- **Components**: Reusable UI components
- **Context**: Global state management (Auth, Alerts)
- **Lib**: Utility functions (API, security, session management)
- **Styles**: CSS styling system

### Backend Architecture

- **Supabase Auth**: User authentication and session management
- **PostgreSQL Database**: Data storage with Row Level Security
- **Supabase Storage**: File storage for videos and payment proofs
- **RLS Policies**: Database-level access control

---

## Technology Stack

### Frontend
- **React 18.2.0** - UI framework
- **React Router DOM 6.20.0** - Routing and navigation
- **Vite 5.0.8** - Build tool and dev server
- **CSS3** - Styling (custom design system)

### Backend & Services
- **Supabase** - Backend as a Service (BaaS)
  - Authentication (PKCE flow)
  - PostgreSQL Database
  - Storage (file uploads)
  - Row Level Security (RLS)

### Development Tools
- **Node.js** (v16+) - Runtime environment
- **npm** - Package manager
- **Git** - Version control

### Deployment
- **Netlify** / **Vercel** - Hosting platforms
- **Environment Variables** - Configuration management

---

## Database Schema

### Core Tables

#### 1. `profiles`
User profile information linked to Supabase Auth users.

```sql
- id (UUID, PRIMARY KEY) → References auth.users(id)
- name (TEXT, NOT NULL)
- role (TEXT, NOT NULL) → 'student' | 'creator' | 'admin'
- profile_slug (TEXT) → URL-friendly identifier
- bio (TEXT) → Creator biography
- profile_image_url (TEXT)
- cover_image_url (TEXT)
- website_url (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 2. `courses`
Course information created by creators.

```sql
- id (UUID, PRIMARY KEY)
- creator_id (UUID) → References profiles(id)
- title (TEXT, NOT NULL)
- description (TEXT, NOT NULL)
- price (DECIMAL(10,2), NOT NULL)
- status (TEXT) → 'draft' | 'pending' | 'published' | 'suspended'
- thumbnail_url (TEXT)
- trailer_video_url (TEXT)
- category_id (UUID) → References categories(id)
- subcategory_id (UUID) → References subcategories(id)
- level (TEXT) → 'beginner' | 'intermediate' | 'advanced'
- tags (TEXT[])
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 3. `modules`
Course modules (sections).

```sql
- id (UUID, PRIMARY KEY)
- course_id (UUID) → References courses(id)
- title (TEXT, NOT NULL)
- order_index (INTEGER, NOT NULL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 4. `lessons`
Individual lessons within modules.

```sql
- id (UUID, PRIMARY KEY)
- module_id (UUID) → References modules(id)
- title (TEXT, NOT NULL)
- video_id (TEXT)
- video_url (TEXT)
- is_trailer (BOOLEAN) → Default: false
- order_index (INTEGER, NOT NULL)
- duration (INTEGER) → Duration in seconds
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 5. `enrollments`
Student course enrollments.

```sql
- id (UUID, PRIMARY KEY)
- student_id (UUID) → References profiles(id)
- course_id (UUID) → References courses(id)
- status (TEXT) → 'pending' | 'approved' | 'rejected'
- approved_by_admin_id (UUID) → References profiles(id)
- approved_at (TIMESTAMP)
- rejection_note (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE(student_id, course_id)
```

#### 6. `payment_proofs`
Payment proof uploads by students.

```sql
- id (UUID, PRIMARY KEY)
- enrollment_id (UUID) → References enrollments(id)
- file_url (TEXT)
- text_proof (TEXT)
- payment_method (TEXT)
- notes (TEXT)
- submitted_at (TIMESTAMP)
```

#### 7. `payout_requests`
Creator payout requests.

```sql
- id (UUID, PRIMARY KEY)
- creator_id (UUID) → References profiles(id)
- amount (DECIMAL(10,2), NOT NULL)
- payment_method (TEXT, NOT NULL)
- status (TEXT) → 'pending' | 'approved' | 'rejected'
- note (TEXT)
- admin_note (TEXT)
- submitted_at (TIMESTAMP)
- approved_at (TIMESTAMP)
- approved_by_admin_id (UUID) → References profiles(id)
```

#### 8. `categories` & `subcategories`
Course categorization system.

```sql
categories:
- id (UUID, PRIMARY KEY)
- name (TEXT, NOT NULL)
- slug (TEXT, UNIQUE)
- icon_url (TEXT)
- order_index (INTEGER)
- created_at (TIMESTAMP)

subcategories:
- id (UUID, PRIMARY KEY)
- category_id (UUID) → References categories(id)
- name (TEXT, NOT NULL)
- slug (TEXT)
- created_at (TIMESTAMP)
```

#### 9. `user_sessions`
Session management for single-device enforcement.

```sql
- id (UUID, PRIMARY KEY)
- user_id (UUID) → References auth.users(id)
- device_id (TEXT) → Browser fingerprint hash
- session_token (TEXT) → Supabase access token
- user_agent (TEXT)
- ip_address (INET)
- is_active (BOOLEAN)
- invalidation_reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 10. `audit_logs` (Optional - See ADD_AUDIT_LOGGING.sql)
Security event logging.

```sql
- id (UUID, PRIMARY KEY)
- user_id (UUID) → References profiles(id)
- event_type (TEXT) → LOGIN_ATTEMPT, ROLE_CHANGED, etc.
- resource_type (TEXT)
- resource_id (UUID)
- details (JSONB)
- ip_address (INET)
- user_agent (TEXT)
- created_at (TIMESTAMP)
```

### Relationships

```
profiles (1) ──< (many) courses
profiles (1) ──< (many) enrollments
profiles (1) ──< (many) payout_requests
courses (1) ──< (many) modules
modules (1) ──< (many) lessons
enrollments (1) ──< (many) payment_proofs
categories (1) ──< (many) subcategories
categories (1) ──< (many) courses
```

### Indexes
- Indexes on foreign keys for performance
- Indexes on status fields for filtering
- Composite indexes for common queries

---

## Authentication & Security

### Authentication Flow

1. **Signup Process**
   - User provides: name, email, password, role (student/creator)
   - Email is sanitized and validated
   - Password requirements: 8+ chars, uppercase, lowercase, number, special char
   - Rate limiting: 5 attempts per 15 minutes
   - Supabase creates auth user
   - Database trigger creates profile automatically
   - Session is created with device fingerprint

2. **Login Process**
   - User provides: email, password
   - Input sanitization and validation
   - Rate limiting check
   - Supabase authentication
   - Session creation (invalidates previous sessions)
   - Profile loading
   - Redirect based on role

3. **Session Management**
   - Single-device enforcement (one active session per user)
   - Device fingerprinting for security
   - Session validation every 60 seconds
   - 24-hour inactivity timeout
   - Automatic logout on device mismatch

### Security Features

#### Implemented ✅
- **Input Sanitization**: XSS prevention
- **Rate Limiting**: Client-side (5 attempts/15 min)
- **CSRF Protection**: PKCE flow via Supabase
- **Content Security Policy**: CSP headers configured
- **HTTPS Enforcement**: HSTS header
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Row Level Security**: Database-level access control
- **Session Management**: Single-device, device fingerprinting
- **Password Requirements**: Strong password validation

#### Partially Implemented ⚠️
- **Server-Side Rate Limiting**: Client-side done, server-side needs Edge Functions
- **Audit Logging**: Schema created, application integration needed

---

## User Roles & Permissions

### 1. Student Role

**Capabilities:**
- Browse all published courses
- View course details and trailers
- Enroll in courses (with payment proof upload)
- View own enrollments (status tracking)
- Access course content after approval
- View own profile

**Restrictions:**
- Cannot create or edit courses
- Cannot approve enrollments
- Cannot view other users' enrollments
- Cannot access course content until enrollment approved

**Routes:**
- `/courses` - Browse courses
- `/course/:id` - Course details
- `/student/dashboard` - Personal dashboard

### 2. Creator Role

**Capabilities:**
- All student capabilities
- Create courses (modules, lessons)
- Edit own courses
- Upload videos and trailers
- View earnings breakdown (total, platform fee, net earnings)
- Request payouts (multiple payment methods)
- Manage creator profile
- View enrollments for own courses (approved only)
- View own payout history

**Restrictions:**
- Cannot approve enrollments
- Cannot manage other creators' content
- Cannot approve/reject courses
- Cannot see pending/rejected enrollments

**Routes:**
- `/creator/dashboard` - Creator dashboard
- `/creator/create-course` - Create new course
- `/creator/edit-course/:id` - Edit course
- `/creator/profile` - Creator profile

### 3. Admin Role

**Capabilities:**
- All creator capabilities
- View all courses (all statuses)
- Approve/reject courses
- View all enrollments
- Approve/reject enrollments
- View all payment proofs
- Manage all payout requests
- Approve/reject payouts
- View all users
- Manage categories
- View platform statistics

**Routes:**
- `/admin/dashboard` - Admin dashboard (tabs: Courses, Enrollments, Payouts)

---

## Features & Functionalities

### 1. Course Management

#### Course Creation (Creator)
- Create course with: title, description, price, category, subcategory, level
- Add modules with custom ordering
- Add lessons to modules
- Upload thumbnail image
- Upload trailer video
- Add tags
- Course status: Draft → Pending → Published → Suspended
- Only published courses appear in public catalog

#### Course Editing (Creator)
- Edit all course details
- Reorder modules and lessons
- Update videos
- Change status (must go through approval for publish)

#### Course Approval (Admin)
- View pending courses
- Approve → Status changes to "Published"
- Reject → Status changes to "Suspended"
- Courses appear in catalog after approval

### 2. Enrollment System

#### Student Enrollment Flow
1. Student browses courses
2. Clicks "Enroll" on a course
3. Enrollment form appears:
   - Course price displayed
   - Payment method selection (bank transfer, mobile payment, cash, etc.)
   - Upload payment proof (image or text)
   - Optional notes
4. Enrollment created with status: "pending"
5. Payment proof stored in database/storage
6. Admin notified (via pending enrollments list)

#### Enrollment Status
- **Pending**: Waiting for admin approval
- **Approved**: Student has access to course content
- **Rejected**: Student cannot access content, rejection note shown

#### Admin Enrollment Management
- View all pending enrollments
- View payment proof
- Approve enrollment → Student gets access
- Reject enrollment → Add rejection note, student sees message

### 3. Payment & Payout System

#### Payment Processing
- Manual payment system (no payment gateway)
- Students upload payment proof
- Admin verifies and approves
- Platform fee calculated automatically (configurable, default 10%)
- Payment fee calculated (default 2%)

#### Creator Earnings
- Total earnings: Sum of all approved enrollments × course price
- Platform fee: Total earnings × platform_fee_percent
- Net earnings: Total earnings - Platform fee - Payment fee
- Available for payout: Net earnings - (approved payouts) - (pending payouts)

#### Payout Requests
- Creator requests payout
- Form includes:
  - Payment method (bank, mobile, cash)
  - Amount (cannot exceed available balance)
  - Optional note
- Status: pending → approved/rejected
- Admin approves/rejects with notes
- Approved payouts reduce available balance

### 4. Course Content Access

#### Access Control
- **Trailer videos**: Always visible to all users
- **Course content**: Only accessible to students with approved enrollment
- Course content locked for:
  - Non-enrolled students
  - Pending enrollments
  - Rejected enrollments

#### Video Management
- Videos stored in Supabase Storage
- Course videos in `course-videos` bucket (public)
- Payment proofs in `payment-proofs` bucket (private)
- Video URLs stored in database
- Support for external video services (e.g., Bunny Stream)

### 5. User Profiles

#### Student Profile
- Basic information (name, email)
- View enrolled courses
- Enrollment status tracking

#### Creator Profile
- Profile page with:
  - Profile slug (URL-friendly)
  - Bio
  - Profile image
  - Cover image
  - Website URL
- View all created courses
- Earnings dashboard
- Payout history

#### Admin Profile
- Access to all admin features
- View platform-wide statistics

### 6. Search & Filtering

#### Course Browsing
- View all published courses
- Filter by category
- Filter by subcategory
- Filter by level (beginner/intermediate/advanced)
- Search functionality (if implemented)
- Course cards with:
  - Thumbnail
  - Title
  - Creator name
  - Price
  - Category

### 7. Notifications & Alerts

#### Alert System
- Success notifications
- Error notifications
- Warning notifications
- Info notifications
- Alert context provider for global alerts

#### Session Notifications
- Session replacement notification (another device logged in)
- Session timeout notification
- Logout messages

---

## File Structure

```
wijha-3/
├── database/                    # Database SQL scripts
│   ├── schema.sql              # Main database schema
│   ├── ADD_AUDIT_LOGGING.sql   # Audit logging schema
│   ├── ADD_SINGLE_DEVICE_SESSIONS.sql
│   ├── ADD_CATEGORIES_SYSTEM.sql
│   └── ... (various migration/fix scripts)
│
├── src/
│   ├── components/             # Reusable components
│   │   ├── Layout.jsx         # Main layout with navigation
│   │   ├── Layout.css
│   │   ├── Alert.jsx          # Alert/notification component
│   │   ├── Alert.css
│   │   ├── BackButton.jsx     # Back navigation button
│   │   ├── ScrollToTop.jsx    # Scroll to top on route change
│   │   ├── SessionGuard.jsx   # Session validation component
│   │   ├── SessionBlockingOverlay.jsx  # Block UI on invalid session
│   │   └── SessionBlockingOverlay.css
│   │
│   ├── context/               # React Context providers
│   │   ├── AuthContext.jsx    # Authentication state management
│   │   └── AlertContext.jsx   # Alert/notification state
│   │
│   ├── lib/                   # Utility libraries
│   │   ├── supabase.js        # Supabase client configuration
│   │   ├── api.js             # API functions (database operations)
│   │   ├── security.js        # Security utilities (sanitization, rate limiting)
│   │   ├── sessionManager.js  # Session management functions
│   │   ├── deviceFingerprint.js  # Device fingerprinting
│   │   └── storage.js         # Storage utilities
│   │
│   ├── pages/                 # Page components
│   │   ├── LandingPage.jsx    # Home/landing page
│   │   ├── LandingPage.css
│   │   ├── Login.jsx          # Login page
│   │   ├── Signup.jsx         # Signup page
│   │   ├── Auth.css           # Shared auth page styles
│   │   ├── CourseBrowse.jsx   # Browse all courses
│   │   ├── CourseDetail.jsx   # Course details page
│   │   ├── Course.css         # Course page styles
│   │   ├── StudentDashboard.jsx  # Student dashboard
│   │   ├── Dashboard.css      # Shared dashboard styles
│   │   ├── CreatorDashboard.jsx  # Creator dashboard
│   │   ├── CreatorDashboard.css
│   │   ├── CreatorProfile.jsx # Creator profile page
│   │   ├── CreatorProfile.css
│   │   ├── CreateCourse.jsx   # Create course form
│   │   ├── EditCourse.jsx     # Edit course form
│   │   ├── CourseForm.css     # Course form styles
│   │   └── AdminDashboard.jsx # Admin dashboard
│   │
│   ├── styles/                # Global styles
│   │   ├── design-system.css  # Design system (colors, typography)
│   │   ├── mobile-responsive.css  # Mobile responsiveness
│   │   └── desktop-scaling.css    # Desktop scaling
│   │
│   ├── App.jsx                # Main app component (routing)
│   ├── main.jsx               # Application entry point
│   └── index.css              # Global CSS
│
├── public/                    # Static files
│   └── _redirects            # Netlify redirects
│
├── scripts/                   # Utility scripts
│   ├── create-env.js         # Environment variable setup
│   └── kill-port.js          # Port management
│
├── dist/                      # Build output (production)
│
├── .env                       # Environment variables (not in git)
├── package.json               # Dependencies and scripts
├── vite.config.js            # Vite configuration
├── netlify.toml              # Netlify deployment config
├── vercel.json               # Vercel deployment config
│
└── Documentation files:
    ├── README.md
    ├── SECURITY_FLOWS.md      # Security documentation
    ├── SECURITY_IMPLEMENTATION_GUIDE.md
    ├── SETUP_GUIDE.md
    ├── QUICK_START.md
    └── TROUBLESHOOTING.md
```

---

## API Integration

### API Functions (`src/lib/api.js`)

The application uses Supabase client for all database operations. Key functions include:

#### Course Operations
- `getAllCourses()` - Get all published courses
- `getCourse(id)` - Get course by ID
- `getCreatorCourses(creatorId)` - Get courses by creator
- `createCourse(courseData)` - Create new course
- `updateCourse(id, courseData)` - Update course
- `deleteCourse(id)` - Delete course

#### Enrollment Operations
- `enrollInCourse(studentId, courseId, paymentData)` - Create enrollment
- `getStudentEnrollments(studentId)` - Get student's enrollments
- `getCourseEnrollments(courseId)` - Get enrollments for a course
- `updateEnrollmentStatus(id, status, adminId, note)` - Update enrollment status

#### Payout Operations
- `createPayoutRequest(creatorId, payoutData)` - Create payout request
- `getAllCreatorPayoutRequests(creatorId)` - Get creator's payouts
- `getAllPayoutRequests()` - Get all payouts (admin)
- `updatePayoutStatus(id, status, adminId, note)` - Update payout status

#### Profile Operations
- `getProfile(userId)` - Get user profile
- `updateProfile(userId, profileData)` - Update profile
- `updateCreatorProfile(creatorId, profileData)` - Update creator profile

#### Earnings Calculations
- `getCreatorEarnings(creatorId)` - Calculate creator earnings
- Earnings breakdown includes:
  - Total earnings
  - Platform fees
  - Payment fees
  - Net earnings
  - Available for payout

### Storage Operations

#### File Uploads
- Course videos → `course-videos` bucket (public)
- Payment proofs → `payment-proofs` bucket (private)
- Profile images → Storage bucket
- Thumbnail images → Storage bucket

### Real-time Features
- Supabase real-time subscriptions (if enabled)
- Session validation
- State updates

---

## Security Implementation

### Authentication Security

1. **Password Requirements**
   - Minimum 8 characters
   - Must contain uppercase letter
   - Must contain lowercase letter
   - Must contain number
   - Must contain special character

2. **Rate Limiting**
   - Client-side: 5 attempts per 15 minutes
   - Tracked per email address
   - LocalStorage-based tracking

3. **Input Sanitization**
   - XSS prevention
   - HTML tag removal
   - Script injection prevention
   - Event handler removal

### Session Security

1. **Single-Device Sessions**
   - One active session per user
   - Previous sessions invalidated on login
   - Device fingerprinting for validation

2. **Session Validation**
   - Periodic validation (every 60 seconds)
   - Device ID matching
   - Session timeout (24 hours inactivity)
   - Route-based validation

3. **Session Invalidation**
   - Logout functionality
   - Device mismatch detection
   - Session replacement detection
   - Automatic cleanup

### Database Security

1. **Row Level Security (RLS)**
   - All tables have RLS enabled
   - Policies enforce role-based access
   - Users can only access their own data
   - Admins have elevated permissions

2. **Helper Functions**
   - `is_user_admin(user_id)` - Admin check
   - `is_user_creator(user_id)` - Creator check
   - `is_user_student(user_id)` - Student check
   - Functions use SECURITY DEFINER for policy checks

### Application Security

1. **Security Headers**
   - Content-Security-Policy (CSP)
   - X-Frame-Options
   - X-Content-Type-Options
   - X-XSS-Protection
   - Referrer-Policy
   - Strict-Transport-Security (HSTS)

2. **CSRF Protection**
   - PKCE flow in Supabase Auth
   - Secure token handling

3. **HTTPS Enforcement**
   - All connections use HTTPS
   - HSTS header configured
   - Secure cookies

For detailed security documentation, see `SECURITY_FLOWS.md` and `SECURITY_IMPLEMENTATION_GUIDE.md`.

---

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project
- Git (for version control)

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd wijha-3
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   npm run create-env
   ```
   Or manually create `.env` file:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Database Setup**
   - Go to Supabase Dashboard > SQL Editor
   - Run `database/schema.sql`
   - Run additional scripts as needed:
     - `ADD_CATEGORIES_SYSTEM.sql`
     - `ADD_SINGLE_DEVICE_SESSIONS.sql`
     - `ADD_AUDIT_LOGGING.sql` (optional)

5. **Storage Setup**
   - Create buckets in Supabase Storage:
     - `course-videos` (public)
     - `payment-proofs` (private)
   - Configure storage policies

6. **Start Development Server**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5173` (Vite default)

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run create-env` - Create environment file
- `npm run kill-port` - Kill process on port 3000

### Development Notes

- Port 3000 is automatically killed before dev server starts
- Hot module replacement (HMR) enabled
- React Strict Mode enabled
- Debug logging in development mode

---

## Deployment

### Deployment Platforms

#### Netlify
- Configuration: `netlify.toml`
- Build command: `npm run build`
- Publish directory: `dist`
- Redirects configured for SPA routing
- Security headers configured

#### Vercel
- Configuration: `vercel.json`
- Automatic detection of build settings
- Security headers configured
- Rewrites for SPA routing

### Environment Variables (Production)

Set these in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY` (if needed server-side)

### Build Process

1. **Build Command**
   ```bash
   npm run build
   ```

2. **Output**
   - Static files in `dist/` directory
   - Optimized and minified
   - Asset hashing for cache busting

3. **Post-Build**
   - Deploy `dist/` directory
   - Configure redirects for SPA
   - Set environment variables
   - Configure security headers

---

## Key Workflows

### 1. User Registration Flow

```
User visits signup page
  ↓
Fills form (name, email, password, role)
  ↓
Input validation & sanitization
  ↓
Rate limiting check
  ↓
Supabase creates auth user
  ↓
Database trigger creates profile
  ↓
Session created with device fingerprint
  ↓
Redirect to role-specific dashboard
```

### 2. Course Creation Flow

```
Creator clicks "Create Course"
  ↓
Fill course details (title, description, price, category)
  ↓
Add modules
  ↓
Add lessons to modules
  ↓
Upload thumbnail & trailer
  ↓
Save course (status: "draft")
  ↓
Submit for approval (status: "pending")
  ↓
Admin reviews
  ↓
Admin approves (status: "published") OR rejects (status: "suspended")
  ↓
Course appears in catalog (if published)
```

### 3. Enrollment Flow

```
Student browses courses
  ↓
Clicks on course
  ↓
Views course details & trailer
  ↓
Clicks "Enroll"
  ↓
Selects payment method
  ↓
Uploads payment proof
  ↓
Enrollment created (status: "pending")
  ↓
Admin reviews enrollment & payment proof
  ↓
Admin approves (status: "approved") OR rejects (status: "rejected")
  ↓
Student gets access (if approved) OR sees rejection note (if rejected)
```

### 4. Payout Request Flow

```
Creator views earnings dashboard
  ↓
Sees available balance
  ↓
Clicks "Request Payout"
  ↓
Selects payment method
  ↓
Enters amount (≤ available balance)
  ↓
Adds optional note
  ↓
Payout request created (status: "pending")
  ↓
Admin reviews request
  ↓
Admin approves (status: "approved") OR rejects (status: "rejected")
  ↓
Creator's available balance updated
```

### 5. Admin Approval Workflow

```
Admin logs in
  ↓
Views dashboard tabs:
  - Courses: Approve/reject pending courses
  - Enrollments: Approve/reject pending enrollments
  - Payouts: Approve/reject payout requests
  ↓
For each item:
  - View details
  - View payment proof (for enrollments)
  - Approve or Reject
  - Add notes (especially for rejections)
  ↓
System updates status
  ↓
Users notified (via UI)
```

---

## Future Improvements

### High Priority
1. **Server-Side Rate Limiting**
   - Implement via Supabase Edge Functions
   - More secure than client-side only

2. **Audit Logging Integration**
   - Application-level logging
   - Login attempt logging
   - Admin action logging

3. **Email Notifications**
   - Enrollment approval/rejection emails
   - Course approval/rejection emails
   - Payout approval/rejection emails

4. **Payment Gateway Integration**
   - Replace manual payment system
   - Automated payment processing
   - Payment verification

### Medium Priority
1. **Search Functionality**
   - Full-text search for courses
   - Advanced filtering options
   - Search by creator, category, price range

2. **Video Streaming**
   - Integration with video service (Bunny Stream)
   - HLS video playback
   - Tokenized video URLs

3. **Reviews & Ratings**
   - Course reviews by students
   - Rating system
   - Review moderation

4. **Analytics Dashboard**
   - Course performance metrics
   - Earnings analytics
   - User engagement metrics

### Low Priority
1. **Mobile App**
   - React Native app
   - iOS and Android support

2. **Live Sessions**
   - Video conferencing integration
   - Live course sessions
   - Recording capabilities

3. **Certificate Generation**
   - Course completion certificates
   - Digital certificates
   - Certificate verification

4. **Multi-language Support**
   - Internationalization (i18n)
   - Language selection
   - Content translation

---

## Important Notes for Developers

### Code Style
- Use functional components with hooks
- Follow React best practices
- Use async/await for async operations
- Handle errors gracefully
- Use context for global state

### Security Considerations
- Never commit `.env` files
- Always validate and sanitize user input
- Use RLS policies for database access
- Follow security best practices (see SECURITY_FLOWS.md)

### Database Guidelines
- Always use RLS policies
- Use parameterized queries (Supabase handles this)
- Use transactions for complex operations
- Keep migrations organized

### Testing Recommendations
- Test all user roles separately
- Test edge cases (empty states, errors)
- Test responsive design
- Test session management
- Test payment flows

### Performance Optimization
- Lazy load components where appropriate
- Optimize images and videos
- Use indexes in database
- Cache frequently accessed data
- Monitor API calls

---

## Support & Documentation

### Key Documentation Files
- `README.md` - Project overview
- `SECURITY_FLOWS.md` - Security documentation
- `SECURITY_IMPLEMENTATION_GUIDE.md` - Security implementation guide
- `SETUP_GUIDE.md` - Detailed setup instructions
- `QUICK_START.md` - Quick start guide
- `TROUBLESHOOTING.md` - Common issues and solutions

### Getting Help
- Check documentation files
- Review code comments
- Check Supabase documentation
- Review React/Supabase best practices

---

## Conclusion

This developer report provides a comprehensive overview of the Wijha course marketplace platform. The application is a full-featured educational platform with robust security, role-based access control, and comprehensive course management capabilities.

For specific implementation details, refer to the source code and inline documentation. For security details, see `SECURITY_FLOWS.md`. For deployment instructions, see `SETUP_GUIDE.md`.

---

**Last Updated:** 2024  
**Version:** 1.0.0  
**Maintainer:** Development Team

