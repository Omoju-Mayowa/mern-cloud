import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import MediaDisplay from './components/MediaDisplay'
import ReactTimeAgo from 'react-time-ago'
import Loader from './components/Loader'

const Search = () => {
    const [searchParams] = useSearchParams()
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

    const resolveUrl = (fileName, type = 'post') => {
        if (!fileName) return type === 'avatar' ? `${assetsBase}/mern/default-avatar.png` : `${assetsBase}/mern/post-placeholder.png`;
        return fileName.startsWith('http') ? fileName : `${assetsBase}/mern/${fileName}`;
    }

    useEffect(() => {
        const query = searchParams.get('q');
        if (query) {
            setLoading(true);
            axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/search?q=${query}`)
                .then(res => setResults(res.data))
                .finally(() => setLoading(false));
        }
    }, [searchParams]);

    if (loading) return <Loader />

    return (
        <section className="search-page">
            <div className="container">
                {results.map(post => (
                    <article key={post._id} className="post">
                        <div className="post__thumbnail">
                            <MediaDisplay src={resolveUrl(post.thumbnail)} type="image" />
                        </div>
                        <div className="post__content">
                            <Link to={`/posts/${post._id}`}><h3>{post.title}</h3></Link>
                            <div className="post__author">
                                <img src={resolveUrl(post.creator?.avatar, 'avatar')} className="post__author-avatar" />
                                <h5>{post.creator?.name}</h5>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    )
}

export default Search
