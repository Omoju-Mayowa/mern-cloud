import React, { useContext, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from './components/axios' // Your custom instance with interceptors
import { UserContext } from './components/context/userContext'

const DeletePost = ({ postId }) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useContext(UserContext)
  const token = currentUser?.token

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete this post?")
    if (!confirmDelete) return

    setIsDeleting(true)
    try {
      await axios.delete(`/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // If we are on the dashboard, we need to refresh the page to show the post is gone
      // If we are on the post detail page, we navigate home
      if (location.pathname.includes('myposts') || location.pathname.includes('dashboard')) {
        window.location.reload() 
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error(err)
      alert("Could not delete post.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button className='btn sm danger' onClick={handleDelete} disabled={isDeleting}>
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  )
}

export default DeletePost
