import React, { useEffect, useState, useContext } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { HiThumbUp } from 'react-icons/hi'
import { UserContext } from './context/userContext'

const LikeButton = ({ postID, initialLikesCount = 0, initialLikedBy = [] }) => {
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)

  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialLikesCount || 0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCount(initialLikesCount || 0)
    if (currentUser && Array.isArray(initialLikedBy)) {
      const curId = currentUser.id || currentUser._id || currentUser.id
      setLiked(initialLikedBy.some(u => String(u) === String(curId)))
    } else {
      setLiked(false)
    }
  }, [currentUser, initialLikedBy, initialLikesCount])

  const handleClick = async () => {
    if (!currentUser) return navigate('/login')
    if (loading) return
    setLoading(true)

    const prevLiked = liked
    const prevCount = count
    setLiked(!prevLiked)
    setCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1)

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/posts/${postID}/like`,
        {},
        { headers: { Authorization: `Bearer ${currentUser.token}` } }
      )

      const data = res.data
      setLiked(Boolean(data.liked))
      if (typeof data.likesCount === 'number') setCount(data.likesCount)
    } catch (err) {
      setLiked(prevLiked)
      setCount(prevCount)
      console.error('Like request failed', err.response?.data || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={`btn like ${liked ? 'clicked' : ''}`}
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      disabled={loading}
    >
      <span><HiThumbUp /></span>
      <span className="like-count" aria-hidden="true">{count}</span>
    </button>
  )
}

export default LikeButton
