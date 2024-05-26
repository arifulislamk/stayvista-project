import { createBrowserRouter } from 'react-router-dom'
import Main from '../layouts/Main'
import Home from '../pages/Home/Home'
import ErrorPage from '../pages/ErrorPage'
import Login from '../pages/Login/Login'
import SignUp from '../pages/SignUp/SignUp'
import RoomDetails from '../pages/RoomDetails/RoomDetails'
import PrivateRoute from './PrivateRoute'
import DashBoardLayout from '../layouts/DashBoardLayout'
import Statistics from '../pages/DashBoard/Common/Statistics'
import MyListings from '../pages/DashBoard/Host/MyListings'
import AddRoom from '../pages/DashBoard/Host/AddRoom'
import Profile from '../pages/DashBoard/Common/Profile'
import ManageUsers from '../pages/DashBoard/Admin/ManageUsers'
import AdminRoute from './AdminRoute'
import HostRoute from './HostRoute'
import MyBookings from '../pages/DashBoard/Guest/MyBookings'
import ManageBookings from '../pages/DashBoard/Host/ManageBookings'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Main />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/room/:id',
        element: <PrivateRoute><RoomDetails /></PrivateRoute>,
      },
    ],
  },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <SignUp /> },
  {
    path: '/dashboard',
    element: <PrivateRoute><DashBoardLayout /></PrivateRoute>,
    children: [
      {
        index: true,
        element: <PrivateRoute> <Statistics /></PrivateRoute>
      },
      {
        path: "add-room",
        element: <PrivateRoute>
          <HostRoute><AddRoom /></HostRoute>
        </PrivateRoute>
      },
      {
        path: "my-listings",
        element: <PrivateRoute>
          <HostRoute><MyListings /></HostRoute>
        </PrivateRoute>
      },
      {
        path: "manage-bookings",
        element: <PrivateRoute>
          <HostRoute><ManageBookings /></HostRoute>
        </PrivateRoute>
      },
      {
        path: "manage-users",
        element: <PrivateRoute>
          <AdminRoute><ManageUsers /></AdminRoute>
        </PrivateRoute>
      },
      {
        path: "my-bookings",
        element: <PrivateRoute>
          <MyBookings />
        </PrivateRoute>
      },
      {
        path: "profile",
        element: <PrivateRoute><Profile /></PrivateRoute>
      }
    ]
  }
])
