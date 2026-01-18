import React, { useEffect, useState } from 'react'
import {Link} from 'react-router-dom'
import axios from 'axios';
import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import usePostStream from './usePostStream'

import en from 'javascript-time-ago/locale/en.json'
import ru from 'javascript-time-ago/locale/ru.json'

TimeAgo.addDefaultLocale(en)
TimeAgo.addLocale(ru)

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const PostAuthor = ({authorID, createdAt}) => {

  const [author, setAuthor] = useState({})

  useEffect(() => {
    const getAuthor = async () => {
      if (!authorID) return setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' })
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${authorID}`)
        setAuthor(response?.data)
      } catch (error) {
        // handle missing author gracefully and surface errors for debugging
        if (error.response?.status === 404) {
          setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' })
        } else {
          console.error('Failed to fetch author:', error.response?.status, error.response?.data || error.message)
          setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' })
        }
      }
    }

    getAuthor()
  }, [authorID])

  // Real-time updates for author profile changes
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(authorID)) {
      setAuthor(payload)
    }
  })

  const baseUrl = import.meta.env.VITE_API_ASSETS_URL || ''
  const assetsBase = baseUrl.replace('/api', '') || baseUrl
  const safeAvatar = author?.avatar || 'avatar-default.png'
  const avatarUrl = safeAvatar && (safeAvatar.startsWith && (safeAvatar.startsWith('http://') || safeAvatar.startsWith('https://'))) ? safeAvatar : `${assetsBase}/mern/${safeAvatar}`

  return (
    <Link onClick={scrollTop} to={`/profile/${authorID}`} className='post__author'>
        <div className="post__author-avatar">
            <img src={avatarUrl} alt="" onError={(e) => { e.target.src = `${assetsBase}/mern/avatar-default.png` }} />
        </div>
        <div className="post__author-details">
            <h5>By: {author?.name}</h5>
            <small><ReactTimeAgo date={new Date(createdAt )} locale='en-US' /></small>
        </div>
    </Link>
  )
}

export default PostAuthor
