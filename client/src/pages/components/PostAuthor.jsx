import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios';
import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import usePostStream from './usePostStream'

import en from 'javascript-time-ago/locale/en.json'
TimeAgo.addDefaultLocale(en)

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const PostAuthor = ({ authorID, createdAt }) => {
  const [author, setAuthor] = useState({})

  useEffect(() => {
    const getAuthor = async () => {
      if (!authorID) return setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' })
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${authorID}`)
        setAuthor(response?.data)
      } catch (error) {
        console.error('Failed to fetch author:', error);
        setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' })
      }
    }
    getAuthor()
  }, [authorID])

  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(authorID)) {
      setAuthor(payload)
    }
  })

  // ==================== FIXED URL LOGIC ====================
  const getAvatarUrl = () => {
    const safeAvatar = author?.avatar;
    
    if (!safeAvatar || safeAvatar === 'default-avatar.png') {
       // Fallback to a hardcoded default if nothing exists
       return `https://your-public-r2-link.dev/avatars/default-avatar.png`; 
    }

    // If it's already a full Cloudflare URL, return it directly
    if (typeof safeAvatar === 'string' && safeAvatar.startsWith('http')) {
      return safeAvatar;
    }

    // Fallback for old database entries that only have the filename
    const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
    return `${assetsBase}/avatars/${safeAvatar}`;
  }

  return (
    <Link onClick={scrollTop} to={`/profile/${authorID}`} className='post__author'>
        <div className="post__author-avatar">
            <img 
              src={getAvatarUrl()} 
              alt={author?.name} 
              onError={(e) => { 
                e.target.onerror = null; 
                e.target.src = 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev/avatars/default-avatar.png'; 
              }} 
            />
        </div>
        <div className="post__author-details">
            <h5>By: {author?.name || 'Unknown'}</h5>
            <small>
              {createdAt ? <ReactTimeAgo date={new Date(createdAt)} locale='en-US' /> : 'Just now'}
            </small>
        </div>
    </Link>
  )
}

export default PostAuthor
