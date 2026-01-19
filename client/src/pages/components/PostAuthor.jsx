import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios';
import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import usePostStream from './usePostStream'
import en from 'javascript-time-ago/locale/en.json'

// Ensure locale is added only once
try {
  TimeAgo.addDefaultLocale(en);
} catch (error) {}

const scrollTop = () => window.scrollTo(0, 0);

const PostAuthor = ({ authorID, createdAt }) => {
  const [author, setAuthor] = useState(null);
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  useEffect(() => {
    const getAuthor = async () => {
      if (!authorID) return;
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${authorID}`);
        setAuthor(response?.data);
      } catch (error) {
        setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' });
      }
    }
    getAuthor();
  }, [authorID]);

  // Listen for real-time profile updates (avatar/name changes)
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(authorID)) {
      setAuthor(payload);
    }
  });

  // Smart URL Resolver to prevent double "mern/" prefixing
  const getAvatarUrl = () => {
    const avatar = author?.avatar;
    if (!avatar || avatar.includes('default')) {
       return `${assetsBase}/mern/default-avatar.png`;
    }
    if (avatar.startsWith('http')) return avatar;
    
    // If the DB already has "mern/", use it directly, otherwise add it.
    const cleanPath = avatar.startsWith('mern/') ? avatar : `mern/${avatar}`;
    return `${assetsBase}/${cleanPath}`;
  };

  return (
    <Link onClick={scrollTop} to={`/profile/${authorID}`} className='post__author'>
      <div className="post__author-avatar">
        <img 
          src={getAvatarUrl()} 
          alt={author?.name || 'Author'} 
          onError={(e) => { e.target.src = `${assetsBase}/mern/default-avatar.png` }}
        />
      </div>
      <div className="post__author-details">
        <h5>By: {author?.name || 'Loading...'}</h5>
        <small><ReactTimeAgo date={new Date(createdAt)} locale='en-US' /></small>
      </div>
    </Link>
  )
}

export default PostAuthor
