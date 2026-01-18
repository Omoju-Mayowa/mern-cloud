import React from 'react'
import { Link } from 'react-router-dom'
import PostAuthor  from './PostAuthor'
import LikeButton from './LikeButton'
import MediaDisplay from './MediaDisplay'

const scrollTop = () => {
  window.scrollTo(0, 0);
}


const PostItem = ({postID, category, title, description, authorID, thumbnail, videoUrl, createdAt, likesCount = 0, likedBy = [], ...props}) => {

  // Strip HTML tags from description
  const stripHtml = (html) => {
    if (!html) return ''
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  }
  const plainDescription = stripHtml(description)
  // ? Shorter Description of post in order to prevent too much use of screen space
  const shortDescription = plainDescription.length > 145 ? plainDescription.substr(0, 145) + '...' : plainDescription;
  // ? Shorter Post Title
  const postTitle = title.length > 60 ? title.substr(0, 120) + '...' : title;
  // ? ImageUrl for thumbnail for easy editing
  const assetsBase = import.meta.env.VITE_API_BASE_URL || 'https://5df0a2941a74cae5cfbfcdd3744c8161.r2.cloudflarestorage.com/mern'
  const safeThumbnail = thumbnail
  const imageUrl = safeThumbnail && (safeThumbnail.startsWith('http://') || safeThumbnail.startsWith('https://')) ? safeThumbnail : `${assetsBase}/mern/${safeThumbnail}`
  // Determine what to display
  // Priority: video with thumbnail poster > thumbnail only > video only > default
  const hasVideo = videoUrl && videoUrl.trim() !== ''
  const hasThumbnail = thumbnail && thumbnail.trim() !== '' && thumbnail !== 'default-avatar.png' && thumbnail !== 'video-placeholder.png'
  
  console.log('Image URL:', imageUrl, 'Thumbnail:', safeThumbnail, 'Video:', videoUrl);
  
  // *
  return (
    <article className="post">
      <div className="post__thumbnail">
        {hasVideo && hasThumbnail ? (
          // Show video with thumbnail as poster
          <MediaDisplay 
            type="video" 
            src={videoUrl} 
            alt={title} 
            autoPlay={true} 
            controls={false} 
            poster={thumbnail}
          />
        ) : hasThumbnail ? (
          // Show thumbnail image only
          <MediaDisplay 
            type="image" 
            src={thumbnail} 
            alt={title} 
          />
        ) : hasVideo ? (
          // Show video only (no thumbnail) - video will display directly
          <MediaDisplay 
            type="video" 
            src={videoUrl} 
            alt={title} 
            autoPlay={true} 
            controls={false} 
          />
        ) : (
          // Default fallback - should rarely happen
          <img src={imageUrl} alt={title} />
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
            {category && category.length > 12 ? category.substring(0, 12) + '...' : category}
          </Link>
        </span>
      </div>
      </div>
    </article>
  )
}

export default PostItem
