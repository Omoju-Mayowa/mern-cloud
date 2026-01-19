import React from 'react'
import { Link } from 'react-router-dom'
import PostAuthor from './PostAuthor'
import LikeButton from './LikeButton'
import MediaDisplay from './MediaDisplay'

const scrollTop = () => { window.scrollTo(0, 0); }

// Smart Resolver for Post Media (Thumbnails and Videos)
const resolveMediaUrl = (path, folder = 'mern') => {
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
  
  if (!path || path.includes('placeholder')) {
      return `${assetsBase}/${folder}/post-placeholder.png`;
  }
  
  if (path.startsWith('http')) return path;

  // Check if prefix folder is already present in the path
  const cleanPath = path.startsWith(`${folder}/`) ? path : `${folder}/${path}`;
  return `${assetsBase}/${cleanPath}`;
};

const PostItem = ({ postID, category, title, description, authorID, thumbnail, videoUrl, createdAt, likesCount = 0, likedBy = [] }) => {
  const finalThumbnail = resolveMediaUrl(thumbnail);
  const finalVideo = resolveMediaUrl(videoUrl);

  const handleMouseEnter = (e) => {
    const video = e.currentTarget.querySelector('video');
    if (video) {
      video.muted = false; // Enable sound on hover
      video.play().catch(() => {});
    }
  };

  const handleMouseLeave = (e) => {
    const video = e.currentTarget.querySelector('video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || '';
  const shortDescription = stripHtml(description).length > 145 
    ? stripHtml(description).substr(0, 145) + '...' 
    : stripHtml(description);

  return (
    <article className="post">
      <div 
        className="post__thumbnail" 
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={handleMouseLeave}
      >
        {videoUrl ? (
          <MediaDisplay 
            type="video" 
            controls={false} 
            muted={false} 
            src={finalVideo} 
            poster={finalThumbnail} 
            alt={title} 
          />
        ) : (
          <MediaDisplay type="image" src={finalThumbnail} alt={title} />
        )}
      </div>
      <div className="post__content">
        <Link to={`/posts/${postID}`} onClick={scrollTop}>
          <h3>{title}</h3>
          <p>{shortDescription}</p>
        </Link>
        <div className="post__footer">
          <PostAuthor authorID={authorID} createdAt={createdAt} />
          <div className="post__footer-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <LikeButton postID={postID} initialLikesCount={likesCount} initialLikedBy={likedBy} />
            <Link className='btn category' onClick={scrollTop} to={`/posts/categories/${category}`}>{category}</Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export default PostItem
