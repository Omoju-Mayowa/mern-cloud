import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import MediaDisplay from './components/MediaDisplay'
import LikeButton from './components/LikeButton'
import ReactTimeAgo from 'react-time-ago'
import Loader from './components/Loader'

const scrollTop = () => window.scrollTo(0, 0);

const Search = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const debounceTimer = useRef(null)

    const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

    // Robust resolver to fix mern/mern/ nesting and missing placeholders
    const resolveUrl = (path, type = 'post') => {
        if (!path || path.includes('default') || path === 'video-placeholder.png') {
            return type === 'avatar' 
                ? `${assetsBase}/mern/default-avatar.png` 
                : `${assetsBase}/mern/post-placeholder.png`;
        }
        if (path.startsWith('http')) return path;
        
        // Fix: If path already contains 'mern/', don't add it again
        const cleanPath = path.startsWith('mern/') ? path : `mern/${path}`;
        return `${assetsBase}/${cleanPath}`;
    }

    const handleSearch = async (query) => {
        if (!query.trim()) { setResults([]); return; }
        setLoading(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/search?q=${query}`)
            setResults(response.data)
        } catch (err) {
            console.error("Search failed", err);
        } finally { setLoading(false) }
    }

    const handleSearchChange = (e) => {
        const query = e.target.value
        setSearchQuery(query)
        setSearchParams(query ? { q: query } : {})
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => handleSearch(query), 400)
    }

    return (
        <section className="posts">
            <div className="container">
                <h2>Search Results</h2>
                <form onSubmit={(e) => e.preventDefault()} className="form login__form">
                    <input
                        type="text"
                        placeholder="Search posts..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        autoFocus
                    />
                </form>

                {loading ? <Loader size='small' /> : (
                    <div className="container posts__container">
                        {results.length > 0 ? results.map(post => (
                            <article key={post._id} className="post">
                                <div className="post__thumbnail">
                                    <MediaDisplay 
                                        type={post.videoUrl ? "video" : "image"} 
                                        src={resolveUrl(post.videoUrl || post.thumbnail)} 
                                        poster={resolveUrl(post.thumbnail)}
                                        alt={post.title} 
                                    />
                                </div>
                                <div className="post__content">
                                    <Link to={`/posts/${post._id}`} onClick={scrollTop}>
                                        <h3>{post.title}</h3>
                                        <p>{post.description?.replace(/<[^>]*>/g, '').substr(0, 145)}...</p>
                                    </Link>
                                    <div className="post__footer">
                                        <div className='post__author'>
                                            <div className="post__author-avatar">
                                                <img 
                                                    src={resolveUrl(post.creator?.avatar, 'avatar')} 
                                                    alt="" 
                                                    onError={e => e.target.src = resolveUrl(null, 'avatar')}
                                                />
                                            </div>
                                            <div className="post__author-details">
                                                <h5>By: {post.creator?.name || 'Anonymous'}</h5>
                                                {post.createdAt && <small><ReactTimeAgo date={new Date(post.createdAt)} locale='en-US' /></small>}
                                            </div>
                                        </div>
                                        <Link className='btn category' to={`/posts/categories/${post.category}`}>{post.category}</Link>
                                    </div>
                                </div>
                            </article>
                        )) : searchQuery && <p className="center">No posts found for "{searchQuery}"</p>}
                    </div>
                )}
            </div>
        </section>
    )
}

export default Search;
