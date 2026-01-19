import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios';
import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import usePostStream from './usePostStream'
import en from 'javascript-time-ago/locale/en.json'

// Ensure locale is added safely
try {
  TimeAgo.addDefaultLocale(en);
} catch (error) {}

const PostAuthor = ({ authorID, createdAt }) => {
  const [author, setAuthor] = useState(null);
  
  // FIX: Ensure we have a string ID. If authorID is an object (populated), use ._id
  const validAuthorID = typeof authorID === 'object' ? authorID?._id : authorID;

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  useEffect(() => {
    const getAuthor = async () => {
      // Use the sanitized ID here
      if (!validAuthorID) return; 

      // OPTIMIZATION: If authorID was already the full object passed from parent, use it immediately!
      if (typeof authorID === 'object' && authorID.name) {
         setAuthor(authorID);
         // We can stop here or continue to fetch fresh data. 
         // Usually, fetching fresh data is safer for real-time updates.
      }

      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${validAuthorID}`);
        setAuthor(response?.data);
      } catch (error) {
        console.warn("Failed to fetch author:", error);
        // Don't overwrite if we already have data from the prop
        if (typeof authorID !== 'object') {
           setAuthor({ name: 'Unknown', avatar: 'default-avatar.png' });
        }
      }
    }
    getAuthor();
  }, [validAuthorID, authorID]); // Depend on the sanitized ID

  // Real-time updates
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(validAuthorID)) {
      setAuthor(payload);
    }
  });

  const getAvatarUrl = () => {
    const avatar = author?.avatar;
    if (!avatar || avatar.includes('default')) {
       return `${assetsBase}/mern/default-avatar.png`;
    }
    if (avatar.startsWith('http')) return avatar;
    
    // Smart resolver
    const cleanPath = avatar.startsWith('mern/') ? avatar : `mern/${avatar}`;
    return `${assetsBase}/${cleanPath}`;
  };

  // Guard clause: If no ID exists at all, don't render a broken link
  if (!validAuthorID) {
    return (
      <div className='post__author'>
        <div className="post__author-avatar">
          <img src={`${assetsBase}/mern/default-avatar.png`} alt="Unknown" />
        </div>
        <div className="post__author-details">
          <h5>Unknown Author</h5>
        </div>
      </div>
    );
  }

  return (
    <Link to={`/profile/${validAuthorID}`} className='post__author'>
      <div className="post__author-avatar">
        <img 
          src={getAvatarUrl()} 
          alt={author?.name || 'Author'} 
          onError={(e) => { 
            e.target.onerror = null; 
            e.target.src = `${assetsBase}/mern/default-avatar.png` 
          }}
        />
      </div>
      <div className="post__author-details">
        <h5>By: {author?.name || 'Loading...'}</h5>
        <small>
          {createdAt && !isNaN(new Date(createdAt)) 
            ? <ReactTimeAgo date={new Date(createdAt)} locale='en-US' /> 
            : 'Just Now'}
        </small>
      </div>
    </Link>
  )
}

export default PostAuthor
