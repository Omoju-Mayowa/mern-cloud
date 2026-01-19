import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
// Import YOUR custom axios
import axios from './components/axios' 
import { UserContext } from './components/context/userContext'

const DeletePost = ({ postId }) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  const token = currentUser?.token

  const handleDelete = async () => {
    // 1. Confirm before deleting
    const confirmDelete = window.confirm("Are you sure you want to delete this post?")
    if(!confirmDelete) return;

    if (!token) return navigate('/login')

    setIsDeleting(true)
    try {
      // 2. Use the interceptor-ready axios instance
      await axios.delete(`/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // 3. Navigate straight home or to dashboard
      navigate('/') 
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('Delete error:', err)
      alert(err.response?.data?.message || 'Failed to delete post')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button 
      onClick={handleDelete} 
      className='btn sm danger' 
      disabled={isDeleting}
    >
      {isDeleting ? '...' : 'Delete'}
    </button>
  )
}

export default DeletePost
