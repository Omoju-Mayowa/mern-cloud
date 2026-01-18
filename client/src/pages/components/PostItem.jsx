// frontend/components/PostItem.jsx
import React from 'react'
import { Link } from 'react-router-dom'
import PostAuthor from './PostAuthor'
import LikeButton from './LikeButton'
import MediaDisplay from './MediaDisplay'

const PostItem = ({postID, category, title, description, authorID, thumbnail, videoUrl, createdAt, likesCount = 0, likedBy = []}) => {
  
  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || '';
  const shortDescription = stripHtml(description).length > 145 ? stripHtml(description).substr(0, 145) + '...' : stripHtml(description);

  // HELPER: Resolves R2 URLs correctly
  const getMediaUrl = (path) => {
    if (!path || path === 'default-avatar.png') return null;
    if (path.startsWith('http')) return path; // Already a full URL from Cloudflare
    
    // Fallback for old records that only saved the filename/key
    const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
    return `${assetsBase}/mern/${path}`;
  };

  const finalThumbnail = getMediaUrl(thumbnail);
  const finalVideo = getMediaUrl(videoUrl);

  return (
    <article className="post">
      <div className="post__thumbnail">
        {finalVideo ? (
          <MediaDisplay 
            type="video" 
            src={finalVideo} 
            poster={finalThumbnail} 
            autoPlay={true} 
            controls={false} 
          />
        ) : finalThumbnail ? (
          <MediaDisplay type="image" src={finalThumbnail} alt={title} />
        ) : (
          <div className="placeholder">No Media</div>
        )}
      </div>
      <div className="post__content">
        <Link to={`/posts/${postID}`}>
          <h3>{title}</h3>
          <p>{shortDescription}</p>
        </Link>
        <div className="post__footer">
          <PostAuthor authorID={authorID} createdAt={createdAt} />
          <span>
            <LikeButton postID={postID} initialLikesCount={likesCount} initialLikedBy={likedBy} />
            <Link className='btn category' to={`/posts/categories/${category}`}>{category}</Link>
          </span>
        </div>
      </div>
    </article>
  )
}

export default PostItem;
