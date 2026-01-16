import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Loader from './components/Loader'
import PostItem from './components/PostItem'
import usePostStream from './components/usePostStream'

const Popular = () => {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts`)
        const data = Array.isArray(response.data) ? response.data : []
        // Sort by likesCount descending; missing likesCount treated as 0
        data.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
        setPosts(data)
      } catch (err) {
        console.error('Failed to fetch popular posts', err.response?.data || err.message)
        setError(err.response?.data?.message || err.message || 'Failed to fetch posts')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPosts()
  }, [])

  // SSE updates
  usePostStream((event, payload) => {
    if (event === 'post_created') {
      setPosts(prev => [payload, ...prev].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)))
    } else if (event === 'post_liked') {
      setPosts(prev => {
        const updated = prev.map(p => (String(p._id) === String(payload.postId) ? { ...p, likesCount: payload.likesCount } : p))
        return updated.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
      })
    } else if (event === 'post_updated') {
      setPosts(prev => {
        const updated = prev.map(p => (String(p._id) === String(payload._id) ? payload : p))
        return updated.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
      })
    } else if (event === 'post_deleted') {
      setPosts(prev => prev.filter(p => String(p._id) !== String(payload.postId)))
    }
  })

  if (isLoading) return <Loader />

  return (
    <section className="posts">
      {error && <p className="error">{error}</p>}
      {posts.length > 0 ? (
        <div className="container posts__container">
          {posts.map(post => (
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
          ))}
        </div>
      ) : (
        <h2 className="center">No popular posts found</h2>
      )}
    </section>
  )
}

export default Popular
