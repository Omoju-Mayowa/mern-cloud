import { render } from 'preact'
import './index.css'
import { injectSpeedInsights } from '@vercel/speed-insights'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'

// Initialize Vercel Speed Insights
injectSpeedInsights()
import Layout from './pages/components/Layout'
import ErrorPage from './pages/ErrorPage'
import Home from './pages/Home'
import Register from './pages/Register'
import Login from './pages/Login'
import UserProfile from './pages/UserProfile'
import Authors from './pages/Authors'
import CreatePost from './pages/CreatePost'
import EditPost from './pages/EditPost'
import DeletePost from './pages/DeletePost'
import Popular from './pages/Popular'
import Search from './pages/Search'
import CategoryPosts from './pages/categoryPosts'
import AuthorPosts from './pages/AuthorPosts'
import Dashboard from './pages/Dashboard'
import Logout from './pages/Logout'
import PostDetail from './pages/PostDetail'
import OTP from './pages/OTP'
import ForgotPassword from './pages/forgotPassword'
import ChangePassword from './pages/changePassword'
import UserProvider from './pages/components/context/userContext'

const router = createBrowserRouter([
  {
    path: '/',
    element: <UserProvider><Layout /></UserProvider>,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: 'popular', element: <Popular /> },
      { path: 'search', element: <Search /> },
      { path: 'posts/:id', element: <PostDetail /> },
      { path: 'register', element: <Register /> },
      { path: 'login', element: <Login /> },
      { path: 'forgotPassword', element: <ForgotPassword /> },
      { path: 'changePassword', element: <ChangePassword /> },
      { path: 'OTP', element: <OTP /> },
      { path: 'profile/:id', element: <UserProfile /> },
      { path: 'authors', element: <Authors /> },
      { path: 'create', element: <CreatePost /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'posts/categories/:category', element: <CategoryPosts /> },
      { path: 'posts/users/:id', element: <AuthorPosts /> },
      { path: 'myposts/:id', element: <Dashboard /> },
      { path: 'posts/:id/edit', element: <EditPost /> },
      { path: 'posts/:id/delete', element: <DeletePost /> },
      { path: 'logout', element: <Logout /> },
    ],
  },
])

window.addEventListener('DOMContentLoaded', () => {
  document.body.style.cursor = "url('/cursor1.png'), auto";
});

render(<RouterProvider router={router} future={{ v7_startTransition: true }} />, document.getElementById('root'))
