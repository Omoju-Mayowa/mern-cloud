import React, { useContext, useEffect, useState } from 'react'
import {Link, useNavigate, useParams} from 'react-router-dom'
import PostAuthor  from './components/PostAuthor'
import LikeButton from './components/LikeButton'
import { UserContext } from './components/context/userContext'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'
import DeletePost from './DeletePost'
import axios from 'axios'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const PostDetail = () => {
  const {id} = useParams()
  const [post, setPost] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const {currentUser} = useContext(UserContext)



  useEffect(() => {
    const getPost = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/${id}`)
        setPost(response?.data)
      } catch (err) {
        setError(  err.response?.data?.message || err.message || 'An error occurred.' )
      }
      setIsLoading(false)
    }

    getPost()
  }, [])

  // SSE: update single post when liked/updated/deleted
  usePostStream((event, payload) => {
    if (event === 'post_liked' && String(payload.postId) === String(id)) {
      setPost(prev => prev ? ({ ...prev, likesCount: payload.likesCount }) : null)
    } else if (event === 'post_updated' && String(payload._id) === String(id)) {
      setPost(payload)
    } else if (event === 'post_deleted' && String(payload.postId) === String(id)) {
      setError('This post has been deleted.')
      setPost(null)
    } else if (event === 'post_created' && String(payload._id) === String(id)) {
      setPost(payload)
    }
  })


  if(isLoading == true) {
    return <Loader />
  }

  // ? ImageUrl for thumbnail for easy editing
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const assetsBase = baseUrl.replace('/api', '') || baseUrl
  const hasVideo = post?.videoUrl && post.videoUrl.trim() !== ''
  const hasThumbnail = post?.thumbnail && post.thumbnail.trim() !== '' && post.thumbnail !== 'default-avatar.png'
  const safeThumbnail = hasThumbnail ? post.thumbnail : null
  const imageUrl = safeThumbnail && (safeThumbnail.startsWith('http://') || safeThumbnail.startsWith('https://')) ? safeThumbnail : (safeThumbnail ? `${assetsBase}/uploads/${safeThumbnail}` : null)

  return (
    <section className="post-detail">
      {error && <p className='error'>{error}</p>}
      {post && 
        <div className="container post-detail__container">
          <div className="post-detail__header">
            <PostAuthor authorID={post?.creator} createdAt={post?.createdAt} />
            {currentUser?.id && String(currentUser.id) === String(post?.creator) && 
              <div className="post-detail__buttons">
                <Link to={ `/posts/${post?._id}/edit`} onClick={scrollTop} className='btn sm primary'>Edit</Link>
                <DeletePost postId={id} />
              </div>
            }
          </div>
          <h1>{post?.title}</h1>
          <div className="post-detail__likes">
            <LikeButton postID={post?._id} initialLikesCount={post?.likesCount} initialLikedBy={post?.likedBy || []} />
          </div>
          <div className="post-detail__thumbnail">
            {hasVideo && hasThumbnail ? (
              <video src={`${assetsBase}/uploads/${post.videoUrl}`} poster={imageUrl} controls className="video-player" />
            ) : hasVideo ? (
              <video src={`${assetsBase}/uploads/${post.videoUrl}`} controls className="video-player" />
            ) : hasThumbnail ? (
              <img src={imageUrl} alt={post.title} />
            ) : (
              <p>No media available</p>
            )}
          </div>
          <p dangerouslySetInnerHTML={{__html: post?.description}}></p>
        </div>
      }
    </section>
  )
}

export default PostDetail