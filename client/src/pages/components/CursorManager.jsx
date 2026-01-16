import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Map your pages to cursor files
import defaultCur from "./cursors/arrow.cur";
import linkCur from "./cursors/hand.cur";
import penCur from "./cursors/nwpen.cur";
import authorCur from "./cursors/person.cur";

const cursorMap = {
  "/": defaultCur,
  "/login": defaultCur,
  "/register": defaultCur,
  "/create": defaultCur,
  "/profile": defaultCur,
};

const CursorManager = () => {
  const location = useLocation();

  useEffect(() => {
    // Determine which cursor to use
    const path = location.pathname;

    let cursor = defaultCur; // default
    for (let route in cursorMap) {
      if (route.endsWith("/") ? path === route : path.startsWith(route)) {
        cursor = cursorMap[route];
      }
    }

    document.querySelector('#root').style.cursor = `url(${cursor}), auto`;

    // Link Custom Cursors
    const links = document.querySelectorAll('a')
    links.forEach((link) => {
      link.style.cursor = `url(${linkCur}), pointer`
    })
    
    // Author's Custom Colors
    const authors = document.querySelectorAll('.author, .post__author')
    authors.forEach((author) => {
      author.style.cursor = `url(${authorCur}), pointer`
    })

    // Inputs, Textareas, Select Cursors
    const inputs = document.querySelectorAll('input, textareas, select, option, .quill, .ql-editor p, form')
    inputs.forEach((input) => {
      input.style.cursor = `url(${penCur}), pointer`
    })

    // Inputs, Textareas, Select Cursors
    const buttons = document.querySelectorAll('.btn, .btn-primary')
    buttons.forEach((button) => {
      button.style.cursor = `url(${linkCur}), pointer`
    })

    return () => {
      links.forEach((link) => {
        link.style.cursor = "";
      });
      authors.forEach((author) => {
        author.style.cursor = "";
      });
      inputs.forEach((input) => {
        input.style.cursor = ""
      })
      buttons.forEach((button) => {
        button.style.cursor = ""
      })
    };
  }, [location]);

  return null; // This component renders nothing visually
};

export default CursorManager;
