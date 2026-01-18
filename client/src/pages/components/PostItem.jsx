import React from 'react'
import { Link } from 'react-router-dom'
import PostAuthor from './PostAuthor'
import LikeButton from './LikeButton'
import MediaDisplay from './MediaDisplay'

const scrollTop = () => { window.scrollTo(0, 0); }

const resolveMediaUrl = (path, folder = 'mern') => {
  if (!path) return `${import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev'}/${folder}/post-placeholder.png`;
  if (path.startsWith('http')) return path;
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
  
  if (path.startsWith(`${folder}/`)) return `${assetsBase}/${path}`;
  return `${assetsBase}/${folder}/${path}`;
};

const PostItem = ({ postID, category, title, description, authorID, thumbnail, videoUrl, createdAt, likesCount = 0, likedBy = [] }) => {
  const finalThumbnail = resolveMediaUrl(thumbnail);
  const finalVideo = resolveMediaUrl(videoUrl);

  const handleMouseEnter = (e) => {
    const video = e.currentTarget.querySelector('video');
    if (video) {
      // We force muted to false here so sound plays
      video.muted = false; 
      video.play().catch(err => {
        // If the user hasn't clicked anywhere yet, this error will show in console
        console.warn("Autoplay with audio requires a user click on the page first.", err);
      });
    }
  };

  const handleMouseLeave = (e) => {
    const video = e.currentTarget.querySelector('video');
    if (video) {
      video.pause();
      video.currentTime = 0; // Resets video when mouse leaves
    }
  };

  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || '';
  const shortDescription = stripHtml(description).length > 145 ? stripHtml(description).substr(0, 145) + '...' : stripHtml(description);

  return (
    <article className="post">
      <div 
        className="post__thumbnail" 
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={handleMouseLeave}
      >
        {finalVideo && videoUrl ? (
          <MediaDisplay 
            type="video" 
            controls={false} 
            muted={false} // Sound is ON
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
          <span>
            <LikeButton postID={postID} initialLikesCount={likesCount} initialLikedBy={likedBy} />
            <Link className='btn category' onClick={scrollTop} to={`/posts/categories/${category}`}>{category}</Link>
          </span>
        </div>
      </div>
    </article>
  )
}

export default PostItem;
