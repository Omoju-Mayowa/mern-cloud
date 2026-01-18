import React from 'react'
import { Link } from 'react-router-dom'
import PostAuthor from './PostAuthor'
import MediaDisplay from './MediaDisplay'

const PostItem = ({ postID, category, title, description, thumbnail, videoUrl, authorID, createdAt }) => {
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';
  
  const finalThumbnail = thumbnail ? (thumbnail.startsWith('http') ? thumbnail : `${assetsBase}/mern/${thumbnail}`) : `${assetsBase}/mern/post-placeholder.png`;
  const finalVideo = videoUrl ? (videoUrl.startsWith('http') ? videoUrl : `${assetsBase}/mern/${videoUrl}`) : null;

  return (
    <article className="post">
      <div className="post__thumbnail">
        {finalVideo ? (
          <video src={finalVideo} poster={finalThumbnail} muted onMouseOver={e => e.target.play()} onMouseOut={e => e.target.pause()} />
        ) : (
          <img src={finalThumbnail} alt={title} />
        )}
      </div>
      <div className="post__content">
        <Link to={`/posts/${postID}`}>
          <h3>{title}</h3>
          <p dangerouslySetInnerHTML={{__html: description.substr(0, 150) + '...'}}></p>
        </Link>
        <div className="post__footer">
          <PostAuthor authorID={authorID} createdAt={createdAt} />
          <Link to={`/posts/categories/${category}`} className='btn category'>{category}</Link>
        </div>
      </div>
    </article>
  )
}

export default PostItem
