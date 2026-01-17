import React, { useEffect, useState } from 'react'
import usePostStream from './usePostStream'

import PostItem from './PostItem'
import Loader from './Loader'
import axios from 'axios'

const Posts = () => {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts`)
        setPosts(Array.isArray(response.data) ? response.data : [])
        console.log({["Fetched Post Data: "]: response.data})
      } catch (err) {
        // show helpful debug information
        console.error('Failed fetching posts:', err.response?.status, err.response?.data || err.message, 'url:', `${import.meta.env.VITE_API_BASE_URL}/posts`)
      }

      setIsLoading(false)
    }

    fetchPosts()
  }, [])

  // SSE: update posts in realtime
  usePostStream((event, payload) => {
    if (event === 'post_created') {
      setPosts(prev => [payload, ...prev])
    } else if (event === 'post_liked') {
      setPosts(prev => prev.map(p => (String(p._id) === String(payload.postId) ? { ...p, likesCount: payload.likesCount } : p)))
    } else if (event === 'post_updated') {
      setPosts(prev => prev.map(p => (String(p._id) === String(payload._id) ? payload : p)))
    } else if (event === 'post_deleted') {
      setPosts(prev => prev.filter(p => String(p._id) !== String(payload.postId)))
    }
  })


  if(isLoading) {
    return <Loader size='normal' />
  }

  return (
    <section className="posts">
        {posts.length > 0 ? <div className="container posts__container">
        {
            posts.map((post) => (
              <PostItem
                key={post._id || post.id}
                postID={post._id || post.id}
                thumbnail={post.thumbnail}
                videoUrl={post.videoUrl}
                category={post.category}
                title={post.title}
                description={post.description}
                authorID={post.creator || post.authorID}
                createdAt={post.createdAt}
                likesCount={post.likesCount}
                likedBy={post.likedBy}
              />
            ))
        }
        </div> : <h2 className='center'>No posts found</h2>}
    </section>
  )
}

export default Posts