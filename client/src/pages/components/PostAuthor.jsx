import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios';
import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import usePostStream from './usePostStream'
import en from 'javascript-time-ago/locale/en.json'

// SAFEST INITIALIZATION:
try {
  TimeAgo.addDefaultLocale(en);
} catch (error) {
  // If it's already added, this prevents the "Locale already added" crash
}

const scrollTop = () => window.scrollTo(0, 0);

const PostAuthor = ({ authorID, createdAt }) => {
  const [author, setAuthor] = useState({ name: '', avatar: '' });

  useEffect(() => {
    const getAuthor = async () => {
      if (!authorID) return;
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${authorID}`);
        setAuthor(response?.data);
      } catch (error) {
        console.error('Failed to fetch author:', error.message);
        setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' });
      }
    }
    getAuthor();
  }, [authorID]);

  // Handle real-time profile updates
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(authorID)) {
      setAuthor(payload);
    }
  });

  // RESOLVE AVATAR URL
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
  
  const getAvatarUrl = () => {
    const avatar = author?.avatar;
    if (!avatar || avatar === 'default-avatar.png') {
       return `${assetsBase}/avatars/default-avatar.png`;
    }
    // If full URL is saved in DB, use it. Otherwise, look in 'avatars' folder
    return avatar.startsWith('http') ? avatar : `${assetsBase}/avatars/${avatar}`;
  };

  return (
    <Link onClick={scrollTop} to={`/profile/${authorID}`} className='post__author'>
      <div className="post__author-avatar">
        <img 
          src={getAvatarUrl()} 
          alt={author?.name} 
          onError={(e) => { e.target.src = `${assetsBase}/avatars/default-avatar.png` }} 
        />
      </div>
      <div className="post__author-details">
        <h5>By: {author?.name || 'Anonymous'}</h5>
        <small>
          {createdAt ? <ReactTimeAgo date={new Date(createdAt)} locale='en-US' /> : 'Just now'}
        </small>
      </div>
    </Link>
  )
}

export default PostAuthor;
