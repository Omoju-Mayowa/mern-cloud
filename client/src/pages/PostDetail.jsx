import React, { useContext, useEffect, useState } from 'react'
import {Link, useParams} from 'react-router-dom'
import PostAuthor from './components/PostAuthor'
import LikeButton from './components/LikeButton'
import { UserContext } from './components/context/userContext'
import Loader from './components/Loader'
import DeletePost from './DeletePost'
import axios from 'axios'

const PostDetail = () => {
  const {id} = useParams()
  const [post, setPost] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const {currentUser} = useContext(UserContext)
  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  useEffect(() => {
    const getPost = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/${id}`)
        setPost(response?.data)
      } catch (err) {
        setError(err.message)
      }
      setIsLoading(false)
    }
    getPost()
  }, [id])

  if (isLoading) return <Loader />

  const imageUrl = post?.thumbnail?.startsWith('http') ? post.thumbnail : `${assetsBase}/mern/${post?.thumbnail}`;
  const videoUrl = post?.videoUrl?.startsWith('http') ? post.videoUrl : `${assetsBase}/mern/${post?.videoUrl}`;

  return (
    <section className="post-detail">
      {error && <p className='error'>{error}</p>}
      {post && (
        <div className="container post-detail__container">
          <div className="post-detail__header">
            <PostAuthor authorID={post.creator} createdAt={post.createdAt} />
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
            ) : post.thumbnail ? (
              <img src={imageUrl} alt="" />
            ) : null}
          </div>
          <p dangerouslySetInnerHTML={{__html: post.description}}></p>
        </div>
      )}
    </section>
  )
}

export default PostDetail
