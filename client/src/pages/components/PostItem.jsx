import React from 'react'
import { Link } from 'react-router-dom'
import PostAuthor from './PostAuthor'
import LikeButton from './LikeButton'
import MediaDisplay from './MediaDisplay'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

// 1. MOVE HELPER OUTSIDE: This prevents recreation on every render
// and makes it easier to manage.
const resolveMediaUrl = (path, folder = 'mern') => {
  if (!path) return null;

  // 1. If it's already a full URL (starts with http), return as is.
  if (path.startsWith('http')) return path;

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  // 2. SMART CHECK: If the path ALREADY includes the folder name 
  // (e.g. "mern/image.jpg"), don't add it again.
  if (path.startsWith(`${folder}/`)) {
    return `${assetsBase}/${path}`;
  }

  // 3. FALLBACK: For old records that are ONLY the filename
  return `${assetsBase}/${folder}/${path}`;
};

const PostItem = ({ postID, category, title, description, authorID, thumbnail, videoUrl, createdAt, likesCount = 0, likedBy = [] }) => {
  
  // 2. USE THE HELPER (The duplicate versions are now gone)
  const finalThumbnail = resolveMediaUrl(thumbnail, 'mern');
  const finalVideo = resolveMediaUrl(videoUrl, 'mern');

  // Strip HTML for description preview
  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || '';
  const shortDescription = stripHtml(description).length > 145 ? stripHtml(description).substr(0, 145) + '...' : stripHtml(description);
  const postTitle = title.length > 60 ? title.substr(0, 60) + '...' : title;

  return (
    <article className="post">
      <div className="post__thumbnail">
        {finalVideo ? (
          <MediaDisplay 
            type="video" 
            src={finalVideo} 
            alt={title} 
            autoPlay={true} 
            controls={false} 
            poster={finalThumbnail}
          />
        ) : finalThumbnail ? (
          <MediaDisplay 
            type="image" 
            src={finalThumbnail} 
            alt={title} 
          />
        ) : (
          <div className="placeholder-box">No Media</div>
        )}
      </div>

      <div className="post__content">
        <Link to={`/posts/${postID}`} onClick={scrollTop}>
          <h3>{postTitle}</h3>
          <p>{shortDescription}</p>
        </Link>
        <div className="post__footer">
          <PostAuthor authorID={authorID} createdAt={createdAt} />
          <span>
            <LikeButton postID={postID} initialLikesCount={likesCount} initialLikedBy={likedBy} />
            <Link className='btn category' onClick={scrollTop} to={`/posts/categories/${category}`}>
              {category}
            </Link>
          </span>
        </div>
      </div>
    </article>
  )
}

export default PostItem;
