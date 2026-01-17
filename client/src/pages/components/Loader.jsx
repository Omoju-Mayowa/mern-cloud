import React from "react";
import LoaderImg from '../images/loading2.gif'

const Loader = ({ size = 'normal' }) => {
  return (
    <div className={ size === 'small' ? 'small-loader' : 'loader'}>
      <div className="loader__image">
        <img src={LoaderImg} alt="Loading..." />
      </div>
    </div>
  )
}


export default Loader;