# Course Marketplace MVP

A modern React-based course marketplace platform with role-based access control (Student, Creator, Super Admin).

## Features

### Authentication
- Login/Signup with role selection (Student, Creator, Admin)
- Mock authentication system (localStorage-based)
- Protected routes based on user roles

### Student Features
- Browse all published courses
- View course details and trailers
- Enroll in courses with payment proof upload
- Dashboard showing enrollment status (Pending/Approved/Rejected)
- Access to course content after approval

### Creator Features
- Create and edit courses
- Upload course videos and trailers
- View earnings breakdown (total, platform fee, net earnings)
- Request payouts with multiple payment methods
- Dashboard showing all created courses

### Super Admin Features
- Approve/reject courses
- Approve/reject student enrollments
- View payment proofs
- Manage payout requests
- Full visibility into all platform activities

## Tech Stack

- **React 18** - UI framework
- **React Router DOM** - Routing and navigation
- **Vite** - Build tool and dev server
- **Supabase** - Backend as a Service (configured)
- **CSS3** - Styling with modern CSS

## Environment Variables

The project uses Supabase for backend services. Environment variables are stored in `.env`:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Public anonymous key (safe for browser)
- `VITE_SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)

Run `npm run create-env` to automatically create the `.env` file with your Supabase credentials.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file (if not already created):
```bash
npm run create-env
```

3. Start the development server:
```bash
npm run dev
```

The server will automatically:
- Kill any process running on port 3000
- Start on port 3000 (strict port mode)

4. Open your browser and navigate to `http://localhost:3000`

**Note:** The dev server is configured to run exclusively on port 3000. If port 3000 is in use, the server will automatically kill the existing process before starting.

### Demo Accounts

For testing purposes, you can use these demo accounts:

- **Student**: `student@test.com` / `password`
- **Creator**: `creator@test.com` / `password`
- **Admin**: `admin@test.com` / `password`

Or create a new account through the signup page.

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Layout.jsx       # Main layout with navigation
│   └── Layout.css
├── context/            # React context providers
│   └── AuthContext.jsx # Authentication context
├── pages/              # Page components
│   ├── Login.jsx       # Login page
│   ├── Signup.jsx      # Signup page
│   ├── StudentDashboard.jsx
│   ├── CreatorDashboard.jsx
│   ├── AdminDashboard.jsx
│   ├── CourseBrowse.jsx
│   ├── CourseDetail.jsx
│   ├── CreateCourse.jsx
│   ├── EditCourse.jsx
│   └── *.css          # Page-specific styles
├── App.jsx             # Main app component with routes
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## Available Scripts

- `npm run create-env` - Create `.env` file with Supabase credentials
- `npm run kill-port` - Kill any process running on port 3000
- `npm run dev` - Start development server on port 3000 (automatically kills port 3000 first)
- `npm run dev:clean` - Explicitly kill port 3000 then start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Features Overview

### Course Management
- Create courses with modules and lessons
- Upload videos and trailers
- Course status workflow: Draft → Pending → Published → Suspended

### Enrollment Flow
1. Student clicks "Enroll" on a course
2. Upload payment proof (image)
3. Enrollment status: Pending
4. Admin reviews and approves/rejects
5. Student gets access (if approved) or rejection note (if rejected)

### Payout System
- Creators can request payouts
- Shows total earnings, platform fee (10%), and net earnings
- Multiple payment methods: Bank, Mobile, Cash
- Admin approves/rejects payout requests

## Notes

- This is a **frontend-only MVP** with mock authentication
- No backend API integration (all data is mocked)
- Authentication uses localStorage for session management
- All forms submit to mock handlers (alerts)
- In production, replace mock functions with actual API calls

## Next Steps

To make this production-ready:
1. Integrate with backend API
2. Replace mock authentication with JWT tokens
3. Add real database integration
4. Implement video streaming (Bunny Stream HLS)
5. Add proper error handling
6. Implement form validation
7. Add loading states
8. Add unit and integration tests

## License

MIT

