import React, { useEffect, useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { UserContext } from './components/context/userContext'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const DeletePost = ({ postId, onSuccess }) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  const token = currentUser?.token

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!token) {
        useEffect(() => {
    navigate('/login')
  }, [])
    }
  }, [token, navigate])

  const handleDelete = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!postId) {
      setError('Post ID not found')
      return
    }

    setIsDeleting(true)

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/posts/${postId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      
      // On success, call optional callback or navigate to dashboard
      if (onSuccess) {
        onSuccess()
      } else {
        navigate('/myposts/' + currentUser.id)
        scrollTop()
      }
    } catch (err) {
      console.error('Delete error:', err)
      setError(err.response?.data?.message || err.message || 'Failed to delete post')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      {error && <p className='form__error-message'>{error}</p>}
      <Link
        onClick={handleDelete}
        disabled={isDeleting}
        className='btn sm danger'
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Link>
    </div>
  )
}

export default DeletePost