import React, { useContext, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PostAuthor from './components/PostAuthor'
import LikeButton from './components/LikeButton'
import { UserContext } from './components/context/userContext'
import Loader from './components/Loader'
import DeletePost from './DeletePost'
import axios from './components/axios' // USE CUSTOM INSTANCE

const PostDetail = () => {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { currentUser } = useContext(UserContext)
  
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  useEffect(() => {
    const getPost = async () => {
      setIsLoading(true)
      try {
        // Using custom axios instance simplifies the URL
        const response = await axios.get(`/posts/${id}`)
        setPost(response?.data)
      } catch (err) { 
        console.error("Error fetching post details:", err) 
      }
      setIsLoading(false)
    }
    getPost()
  }, [id])

  // Smart Resolver for Consistency
  const resolveUrl = (path, folder = 'mern') => {
    if (!path || path.includes('placeholder')) {
      return `${assetsBase}/${folder}/post-placeholder.png`;
    }
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith(`${folder}/`) ? path : `${folder}/${path}`;
    return `${assetsBase}/${cleanPath}`;
  };

  if (isLoading) return <Loader />

  const imageUrl = resolveUrl(post?.thumbnail);
  const videoUrl = resolveUrl(post?.videoUrl);

  return (
    <section className="post-detail">
      {post && (
        <div className="container post-detail__container">
          <div className="post-detail__header">
            {/* Flex container to align LikeButton and Author */}
            <div className="post-detail__meta" style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', width: '100%' }}>
              <PostAuthor authorID={post.creator} createdAt={post.createdAt} />
              <LikeButton 
                postID={post._id} 
                initialLikesCount={post.likesCount} 
                initialLikedBy={post.likedBy} 
              />
            </div>

            {currentUser?.id === post.creator && (
              <div className="post-detail__buttons">
                <Link to={`/posts/${post._id}/edit`} className='btn sm primary'>Edit</Link>
                <DeletePost postId={id} />
              </div>
            )}
          </div>

          <h1>{post.title}</h1>
          
          <div className="post-detail__thumbnail">
            {post.videoUrl ? (
              <video src={videoUrl} poster={imageUrl} controls className="video-player" />
            ) : (
              <img src={imageUrl} alt={post.title} />
            )}
          </div>

          <div className="post-detail__description">
            <p dangerouslySetInnerHTML={{ __html: post.description }}></p>
          </div>
        </div>
      )}
    </section>
  )
}

export default PostDetail;
