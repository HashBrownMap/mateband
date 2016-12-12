/**
 * main.js
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 * 
 * Copyright 2015, Codrops
 * http://www.codrops.com
 */
;(function(window) {

	'use strict';

	var support = { transitions: Modernizr.csstransitions },
		// transition end event name
		transEndEventNames = { 'WebkitTransition': 'webkitTransitionEnd', 'MozTransition': 'transitionend', 'OTransition': 'oTransitionEnd', 'msTransition': 'MSTransitionEnd', 'transition': 'transitionend' },
		transEndEventName = transEndEventNames[ Modernizr.prefixed( 'transition' ) ],
		onEndTransition = function( el, callback ) {
			var onEndCallbackFn = function( ev ) {
				if( support.transitions ) {
					if( ev.target != this ) return;
					this.removeEventListener( transEndEventName, onEndCallbackFn );
				}
				if( callback && typeof callback === 'function' ) { callback.call(this); }
			};
			if( support.transitions ) {
				el.addEventListener( transEndEventName, onEndCallbackFn );
			}
			else {
				onEndCallbackFn();
			}
		};

	/**
	 * some helper functions
	 */
	
	function throttle(fn, delay) {
		var allowSample = true;

		return function(e) {
			if (allowSample) {
				allowSample = false;
				setTimeout(function() { allowSample = true; }, delay);
				fn(e);
			}
		};
	}

	function nextSibling(el) {
		var nextSibling = el.nextSibling;
		while(nextSibling && nextSibling.nodeType != 1) {
			nextSibling = nextSibling.nextSibling
		}
		return nextSibling;
	}

	function extend( a, b ) {
		for( var key in b ) { 
			if( b.hasOwnProperty( key ) ) {
				a[key] = b[key];
			}
		}
		return a;
	}

	/**
	 * GridFx obj
	 */
	function GridFx(el, options) {
		this.gridEl = el;
		this.options = extend( {}, this.options );
		extend( this.options, options );
		
		this.items = [].slice.call(this.gridEl.querySelectorAll('.grid__item'));
		this.previewEl = nextSibling(this.gridEl);
		this.isExpanded = false;
		this.isAnimating = false;
		this.closeCtrl = this.previewEl.querySelector('button.action--close');
		this.previewDescriptionEl = this.previewEl.querySelector('.description--preview');

		this._init();
	}

	/**
	 * options
	 */
	GridFx.prototype.options = {
		pagemargin : 0,
		// x and y can have values from 0 to 1 (percentage). If negative then it means the alignment is left and/or top rather than right and/or bottom
		// so, as an example, if we want our large image to be positioned vertically on 25% of the screen and centered horizontally the values would be x:1,y:-0.25
		imgPosition : { x : 1, y : 1 },
		onInit : function(instance) { return false; },
		onResize : function(instance) { return false; },
		onOpenItem : function(instance, item) { return false; },
		onCloseItem : function(instance, item) { return false; },
		onExpand : function() { return false; }
	}

	GridFx.prototype._init = function() {
		// callback
		this.options.onInit(this);

		var self = this;
		// init masonry after all images are loaded
		imagesLoaded( this.gridEl, function() {
			// initialize masonry
			new Masonry(self.gridEl, {
				itemSelector: '.grid__item',
				isFitWidth : true
			});
			// show grid after all images (thumbs) are loaded
			classie.add(self.gridEl, 'grid--loaded');
			// init/bind events
			self._initEvents();
			// create the large image and append it to the DOM
			self._setOriginal();
			// create the clone image and append it to the DOM
			self._setClone();
		});
	};

	/**
	 * initialize/bind events
	 */
	GridFx.prototype._initEvents = function () {
		var self = this,
			clickEvent = (document.ontouchstart!==null ? 'click' : 'touchstart');

		this.items.forEach(function(item) {
			var touchend = function(ev) {
					ev.preventDefault();
					self._openItem(ev, item);
					item.removeEventListener('touchend', touchend);	
				},
				touchmove = function(ev) {
					item.removeEventListener('touchend', touchend);	
				},
				manageTouch = function() {
					item.addEventListener('touchend', touchend);
					item.addEventListener('touchmove', touchmove);
				};

			item.addEventListener(clickEvent, function(ev) {
				if(clickEvent === 'click') {
					ev.preventDefault();
					self._openItem(ev, item);
				}
				else {
					manageTouch();
				}
			});
		});

		// close expanded image
		this.closeCtrl.addEventListener('click', function() {
			self._closeItem(); 
		});

		window.addEventListener('resize', throttle(function(ev) {
			// callback
			self.options.onResize(self);
		}, 10));
	}

	/**
	 * open a grid item
	 */
	GridFx.prototype._openItem = function(ev, item) {
		if( this.isAnimating || this.isExpanded ) return;
		this.isAnimating = true;
		this.isExpanded = true;

		// item's image
		var gridImg = item.querySelector('img'),
			gridImgOffset = gridImg.getBoundingClientRect();

		// index of current item
		this.current = this.items.indexOf(item);

		// set the src of the original image element (large image)
		this._setOriginal(item.querySelector('a').getAttribute('href'));
		
		// callback
		this.options.onOpenItem(this, item);

		// set the clone image
		this._setClone(gridImg.src, {
			width : gridImg.offsetWidth,
			height : gridImg.offsetHeight,
			left : gridImgOffset.left,
			top : gridImgOffset.top
		});

		// hide original grid item
		classie.add(item, 'grid__item--current');

		// calculate the transform value for the clone to animate to the full image view
		var win = this._getWinSize(),
			originalSizeArr = item.getAttribute('data-size').split('x'),
			originalSize = {width: originalSizeArr[0], height: originalSizeArr[1]},
			dx = ((this.options.imgPosition.x > 0 ? 1-Math.abs(this.options.imgPosition.x) : Math.abs(this.options.imgPosition.x)) * win.width + this.options.imgPosition.x * win.width/2) - gridImgOffset.left - 0.5 * gridImg.offsetWidth,
			dy = ((this.options.imgPosition.y > 0 ? 1-Math.abs(this.options.imgPosition.y) : Math.abs(this.options.imgPosition.y)) * win.height + this.options.imgPosition.y * win.height/2) - gridImgOffset.top - 0.5 * gridImg.offsetHeight,
			z = Math.min( Math.min(win.width*Math.abs(this.options.imgPosition.x) - this.options.pagemargin, originalSize.width - this.options.pagemargin)/gridImg.offsetWidth, Math.min(win.height*Math.abs(this.options.imgPosition.y) - this.options.pagemargin, originalSize.height - this.options.pagemargin)/gridImg.offsetHeight );

		// apply transform to the clone
		this.cloneImg.style.WebkitTransform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0) scale3d(' + z + ', ' + z + ', 1)';
		this.cloneImg.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0) scale3d(' + z + ', ' + z + ', 1)';

		// add the description if any
		var descriptionEl = item.querySelector('.description');
		if( descriptionEl ) {
			this.previewDescriptionEl.innerHTML = descriptionEl.innerHTML;
		}

		var self = this;
		setTimeout(function() { 
			// controls the elements inside the expanded view
			classie.add(self.previewEl, 'preview--open');
			// callback
			self.options.onExpand();
		}, 0);

		// after the clone animates..
		onEndTransition(this.cloneImg, function() {
			// when the original/large image is loaded..
			imagesLoaded(self.originalImg, function() {
				// close button just gets shown after the large image gets loaded
				classie.add(self.previewEl, 'preview--image-loaded');
				// animate the opacity to 1
				self.originalImg.style.opacity = 1;
				// and once that's done..
				onEndTransition(self.originalImg, function() {
					// reset cloneImg
					self.cloneImg.style.opacity = 0;
					self.cloneImg.style.WebkitTransform = 'translate3d(0,0,0) scale3d(1,1,1)';
					self.cloneImg.style.transform = 'translate3d(0,0,0) scale3d(1,1,1)';

					self.isAnimating = false;
				});
				
			});	
		});
	};

	/**
	 * create/set the original/large image element
	 */
	GridFx.prototype._setOriginal = function(src) {
		if( !src ) {
			this.originalImg = document.createElement('img');
			this.originalImg.className = 'original';
			this.originalImg.style.opacity = 0;
			this.originalImg.style.maxWidth = 'calc(' + parseInt(Math.abs(this.options.imgPosition.x)*100) + 'vw - ' + this.options.pagemargin + 'px)';
			this.originalImg.style.maxHeight = 'calc(' + parseInt(Math.abs(this.options.imgPosition.y)*100) + 'vh - ' + this.options.pagemargin + 'px)';
			// need it because of firefox
			this.originalImg.style.WebkitTransform = 'translate3d(0,0,0) scale3d(1,1,1)';
			this.originalImg.style.transform = 'translate3d(0,0,0) scale3d(1,1,1)';
			src = '';
			this.previewEl.appendChild(this.originalImg);
		}

		this.originalImg.setAttribute('src', src);
	};

	/**
	 * create/set the clone image element
	 */
	GridFx.prototype._setClone = function(src, settings) {
		if( !src ) {
			this.cloneImg = document.createElement('img');
			this.cloneImg.className = 'clone';
			src = '';
			this.cloneImg.style.opacity = 0;
			this.previewEl.appendChild(this.cloneImg);
		}
		else {
			this.cloneImg.style.opacity = 1;
			// set top/left/width/height of grid item's image to the clone
			this.cloneImg.style.width = settings.width  + 'px';
			this.cloneImg.style.height = settings.height  + 'px';
			this.cloneImg.style.top = settings.top  + 'px';
			this.cloneImg.style.left = settings.left  + 'px';
		}

		this.cloneImg.setAttribute('src', src);
	};

	/**
	 * closes the original/large image view
	 */
	GridFx.prototype._closeItem = function() {
		if( !this.isExpanded || this.isAnimating ) return;
		this.isExpanded = false;
		this.isAnimating = true;

		// the grid item's image and its offset
		var gridItem = this.items[this.current],
			gridImg = gridItem.querySelector('img'),
			gridImgOffset = gridImg.getBoundingClientRect(),
			self = this;

		classie.remove(this.previewEl, 'preview--open');
		classie.remove(this.previewEl, 'preview--image-loaded');
		
		// callback
		this.options.onCloseItem(this, gridItem);

		// large image will animate back to the position of its grid's item
		classie.add(this.originalImg, 'animate');

		// set the transform to the original/large image
		var win = this._getWinSize(),
			dx = gridImgOffset.left + gridImg.offsetWidth/2 - ((this.options.imgPosition.x > 0 ? 1-Math.abs(this.options.imgPosition.x) : Math.abs(this.options.imgPosition.x)) * win.width + this.options.imgPosition.x * win.width/2),
			dy = gridImgOffset.top + gridImg.offsetHeight/2 - ((this.options.imgPosition.y > 0 ? 1-Math.abs(this.options.imgPosition.y) : Math.abs(this.options.imgPosition.y)) * win.height + this.options.imgPosition.y * win.height/2),
			z = gridImg.offsetWidth/this.originalImg.offsetWidth;

		this.originalImg.style.WebkitTransform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0) scale3d(' + z + ', ' + z + ', 1)';
		this.originalImg.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0) scale3d(' + z + ', ' + z + ', 1)';	
		
		// once that's done..
		onEndTransition(this.originalImg, function() {
			// clear description
			self.previewDescriptionEl.innerHTML = '';

			// show original grid item
			classie.remove(gridItem, 'grid__item--current');

			// fade out the original image
			setTimeout(function() { self.originalImg.style.opacity = 0;	}, 60);

			// and after that
			onEndTransition(self.originalImg, function() {
				// reset original/large image
				classie.remove(self.originalImg, 'animate');
				self.originalImg.style.WebkitTransform = 'translate3d(0,0,0) scale3d(1,1,1)';
				self.originalImg.style.transform = 'translate3d(0,0,0) scale3d(1,1,1)';

				self.isAnimating = false;
			});
		});
	};

	/**
	 * gets the window sizes
	 */
	GridFx.prototype._getWinSize = function() {
		return {
			width: document.documentElement.clientWidth,
			height: window.innerHeight
		};
	};

	window.GridFx = GridFx;

})(window);

(function() {

    var width, height, largeHeader, canvas, ctx, points, target, animateHeader = true;

    // Main
    initHeader();
    initAnimation();
    addListeners();

    function initHeader() {
        width = window.innerWidth;
        height = window.innerHeight;
        target = {x: width/2, y: height/2};

        largeHeader = document.getElementById('large-header');
        largeHeader.style.height = height+'px';

        canvas = document.getElementById('demo-canvas');
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d');

        // create points
        points = [];
        for(var x = 0; x < width; x = x + width/12) {
            for(var y = 0; y < height; y = y + height/12) {
                var px = x + Math.random()*width/12;
                var py = y + Math.random()*height/12;
                var p = {x: px, originX: px, y: py, originY: py };
                points.push(p);
            }
        }

		 if ($(window).width() > 2000) {
          for(var x = 0; x < width; x = x + width/13) {
            for(var y = 0; y < height; y = y + height/13) {
                var px = x + Math.random()*width/13;
                var py = y + Math.random()*height/13;
                var p = {x: px, originX: px, y: py, originY: py };
                points.push(p);
            }
        }    
    }

        // for each point find the 5 closest points
        for(var i = 0; i < points.length; i++) {
            var closest = [];
            var p1 = points[i];
            for(var j = 0; j < points.length; j++) {
                var p2 = points[j]
                if(!(p1 == p2)) {
                    var placed = false;
                    for(var k = 0; k < 5; k++) {
                        if(!placed) {
                            if(closest[k] == undefined) {
                                closest[k] = p2;
                                placed = true;
                            }
                        }
                    }

                    for(var k = 0; k < 5; k++) {
                        if(!placed) {
                            if(getDistance(p1, p2) < getDistance(p1, closest[k])) {
                                closest[k] = p2;
                                placed = true;
                            }
                        }
                    }
                }
            }
            p1.closest = closest;
        }

        // assign a circle to each point
        for(var i in points) {
            var c = new Circle(points[i], 2+Math.random()*2, 'rgba(255,255,255,0.8');
            points[i].circle = c;
        }
    }

    // Event handling
    function addListeners() {
        if(!('ontouchstart' in window)) {
            window.addEventListener('mousemove', mouseMove);
        }
        window.addEventListener('scroll', scrollCheck);
        window.addEventListener('resize', resize);
    }

    function mouseMove(e) {
        var posx = posy = 0;
        if (e.pageX || e.pageY) {
            posx = e.pageX;
            posy = e.pageY;
        }
        else if (e.clientX || e.clientY)    {
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        target.x = posx;
        target.y = posy;
    }

    function scrollCheck() {
        if(document.body.scrollTop > height) animateHeader = false;
        else animateHeader = true;
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        largeHeader.style.height = height+'px';
        canvas.width = width;
        canvas.height = height;
    }

    // animation
    function initAnimation() {
        animate();
        for(var i in points) {
            shiftPoint(points[i]);
        }
    }

    function animate() {
        if(animateHeader) {
            ctx.clearRect(0,0,width,height);
            for(var i in points) {
                // detect points in range
                if(Math.abs(getDistance(target, points[i])) < 14000) {
                    points[i].active = 0.3;
                    points[i].circle.active = 1;
                } else if(Math.abs(getDistance(target, points[i])) < 30000) {
                    points[i].active = 0.1;
                    points[i].circle.active = 0.5;
                } else if(Math.abs(getDistance(target, points[i])) < 60000) {
                    points[i].active = 0.02;
                    points[i].circle.active = 0.3;
                 } else if(Math.abs(getDistance(target, points[i])) < 70000) {
                    points[i].active = 0;
                    points[i].circle.active = 0.2;
                } else {
                    points[i].active = 0;
                    points[i].circle.active = 0;
                }

                drawLines(points[i]);
                points[i].circle.draw();
            }

			 if ($(window).width() > 2000) {
            for(var i in points) {
                // detect points in range
                if(Math.abs(getDistance(target, points[i])) < 14000) {
                    points[i].active = 0.3;
                    points[i].circle.active = 1;
                } else if(Math.abs(getDistance(target, points[i])) < 60000) {
                    points[i].active = 0.1;
                    points[i].circle.active = 0.5;
                } else if(Math.abs(getDistance(target, points[i])) < 90000) {
                    points[i].active = 0.02;
                    points[i].circle.active = 0.3;
                 } else if(Math.abs(getDistance(target, points[i])) < 150000) {
                    points[i].active = 0;
                    points[i].circle.active = 0.2;
                } else {
                    points[i].active = 0;
                    points[i].circle.active = 0;
                }

                drawLines(points[i]);
                points[i].circle.draw();
            }    
    }
        }
        requestAnimationFrame(animate);
    }

    function shiftPoint(p) {
        TweenLite.to(p, 1+1*Math.random(), {x:p.originX-50+Math.random()*100,
            y: p.originY-50+Math.random()*100, ease:Circ.easeInOut,
            onComplete: function() {
                shiftPoint(p);
            }});
    }

    // Canvas manipulation
    function drawLines(p) {
        if(!p.active) return;
        for(var i in p.closest) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.closest[i].x, p.closest[i].y);
            ctx.strokeStyle = 'rgba(8,112,138,'+ p.active+')';
            ctx.stroke();
        }
    }

    function Circle(pos,rad,color) {
        var _this = this;

        // constructor
        (function() {
            _this.pos = pos || null;
            _this.radius = rad || null;
            _this.color = color || null;
        })();

        this.draw = function() {
            if(!_this.active) return;
            ctx.beginPath();
            ctx.arc(_this.pos.x, _this.pos.y, _this.radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(215,58,49,'+ _this.active+')';
            ctx.fill();
        };
    }

    // Util
    function getDistance(p1, p2) {
        return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
    }
    
})();

;(function(window) {
	
	'use strict';

	// Helper vars and functions.
	function extend(a, b) {
		for( var key in b ) { 
			if( b.hasOwnProperty( key ) ) {
				a[key] = b[key];
			}
		}
		return a;
	}
	/**
	 * Throttle fn: From https://sberry.me/articles/javascript-event-throttling-and-debouncing
	 */
	function throttle(fn, delay) {
		var allowSample = true;

		return function(e) {
			if (allowSample) {
				allowSample = false;
				setTimeout(function() { allowSample = true; }, delay);
				fn(e);
			}
		};
	}
	/**
	 * Mouse position: From http://www.quirksmode.org/js/events_properties.html#position.
	 */
	function getMousePos(e) {
		var posx = 0, posy = 0;
		if (!e) var e = window.event;
		if (e.pageX || e.pageY) 	{
			posx = e.pageX;
			posy = e.pageY;
		}
		else if (e.clientX || e.clientY) 	{
			posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
			posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
		}
		return { x : posx, y : posy };
	}
	/**
	 * Distance between two points P1 (x1,y1) and P2 (x2,y2).
	 */
	function distancePoints(x1, y1, x2, y2) {
		return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
	}
	/**
	 * Equation of a line.
	 */
	function lineEq(y2, y1, x2, x1, currentVal) {
		// y = mx + b
		var m = (y2 - y1) / (x2 - x1),
			b = y1 - m * x1;

		return m * currentVal + b;
	}

	var docScrolls = {left : document.body.scrollLeft + document.documentElement.scrollLeft, top : document.body.scrollTop + document.documentElement.scrollTop};

	/**
	 * Point obj.
	 */
	function Point(el, bgEl, wrapper, options) {
		this.el = el;
		this.wrapper = wrapper;
		// Options/Settings.
		this.options = extend( {}, this.options );
		extend( this.options, options );
		// A Point obj has a background element (img, video, ..) and a point/position (x,y) in the canvas.
		this.bgEl = bgEl;
		// The position of the point.
		this.position = this._updatePosition();
		// When the mouse is dmax away from the point, its image gets opacity = 0.
		this.dmax = this.options.viewportFactor != -1 && this.options.viewportFactor > 0 ? this.wrapper.offsetWidth/this.options.viewportFactor : this.options.maxDistance;
		if( this.dmax < this.options.activeOn ) {
			this.options.activeOn = this.dmax-5; // todo
		}
		// Init/Bind events.
		this._initEvents();
	}

	/**
	 * Point options/settings.
	 */
	Point.prototype.options = {
		// Maximum opacity that the bgEl can have.
		maxOpacity : 1,
		// When the mouse is [activeOn]px away from the point, its image gets opacity = this.options.maxOpacity.
		activeOn : 20,
		// The distance from the mouse pointer to a Point where the opacity of the background element is 0.
		maxDistance : 100, 
		// If viewportFactor is different than -1, then the maxDistance will be overwritten by [window´s width / viewportFactor]
		viewportFactor : -1,
		onActive : function() { return false; },
		onInactive : function() { return false; },
		onClick : function() { return false; }
	};

	/**
	 * Initialize/Bind events.
	 */
	Point.prototype._initEvents = function() {
		var self = this;

		// Mousemove event.
		this._throttleMousemove = throttle(function(ev) {
			requestAnimationFrame(function() {
				// Mouse position relative to the mapEl.
				var mousepos = getMousePos(ev);
				// Calculate the opacity value.
				if( self.bgEl ) {
					// Distance from the position of the point to the mouse position.
					var distance = distancePoints(mousepos.x - docScrolls.left, mousepos.y - docScrolls.top, self.position.x - docScrolls.left, self.position.y - docScrolls.top),
						// Convert this distance to a opacity value. (distance = 0 -> opacity = 1).
						opacity = self._distanceToOpacity(distance);

					self.bgEl.style.opacity = opacity;

					// Callback
					if( !self.isActive && opacity === self.options.maxOpacity ) {
						self.options.onActive();
						self.isActive = true;
					}
					
					if( opacity !== self.options.maxOpacity && self.isActive ) {
						self.options.onInactive();
						self.isActive = false;
					}
				}
			});
		}, 20);
		this.wrapper.addEventListener('mousemove', this._throttleMousemove);

		// Clicking a point.
		this._click = function(ev) {
			// Callback.
			self.options.onClick();
		};
		//this.el.addEventListener('click', this._click);

		// Window resize.
		this._throttleResize = throttle(function() {
			// Update Point´s position.
			self.position = self._updatePosition();
			// Update dmax
			if( self.options.viewportFactor != -1 && self.options.viewportFactor > 0 ) {
				self.dmax = self.wrapper.offsetWidth/self.options.viewportFactor;
			}
		}, 100);
		window.addEventListener('resize', this._throttleResize);

		// Set the opacity of the bgEl to 0 when leaving the wrapper area..
		this.wrapper.addEventListener('mouseleave', function() {
			if( !self.isActive ) {
				self.bgEl.style.opacity = 0;
			}
		});
	};

	/**
	 * Update Point´s position.
	 */
	Point.prototype._updatePosition = function() {
		var rect = this.el.getBoundingClientRect(), bbox = this.el.getBBox();
		// Also update origins..
		this.el.style.transformOrigin = this.el.style.WebkitTransformOrigin = (bbox.x + rect.width/2) + 'px ' + (bbox.y + rect.height) + 'px';
		return {x : rect.left + rect.width/2 + docScrolls.left, y : rect.top + rect.height/2 + docScrolls.top};
	};

	/**
	 * Maps the distance to opacity.
	 */
	Point.prototype._distanceToOpacity = function(d) {
		return Math.min(Math.max(lineEq(this.options.maxOpacity, 0, this.options.activeOn, this.dmax, d), 0), this.options.maxOpacity);
	};

	/**
	 * Hides the Point.
	 */
	Point.prototype.hide = function() {
		lunar.addClass(this.el, 'point--hide');
	};

	/**
	 * 
	 */
	Point.prototype.show = function() {
		lunar.removeClass(this.el, 'point--hide')
	};

	/**
	 * 
	 */
	Point.prototype.pause = function() {
		this.wrapper.removeEventListener('mousemove', this._throttleMousemove);
	};

	/**
	 * 
	 */
	Point.prototype.resume = function() {
		this.wrapper.addEventListener('mousemove', this._throttleMousemove);
	};

	/**
	 * PointsMap obj.
	 */
	function PointsMap(el, options) {
		this.el = document.getElementById('interactive-1');
		// Options/Settings.
		this.options = extend( {}, this.options );
		extend( this.options, options );
		
		// Backgrounds container.
		this.bgsWrapper = this.el.querySelector('.backgrounds');
		if( !this.bgsWrapper ) { return; }
		
		// Background elements.
		this.bgElems = [].slice.call(this.bgsWrapper.querySelectorAll('.background__element'));
		// Total background elements.
		this.bgElemsTotal = this.bgElems.length;
		if( this.bgElemsTotal <= 1 ) { return; }
		
		// Points container.
		this.pointsWrapper = this.el.querySelector('.points');
		if( !this.pointsWrapper || getComputedStyle(this.pointsWrapper, null).display === 'none' ) { return; }

		// Points tooltips
		this.tooltips = [].slice.call(this.el.querySelector('.points-tooltips').children);

		// Points´s content
		this.pointsContentWrapper = this.el.querySelector('.points-content');
		this.contents = [].slice.call(this.pointsContentWrapper.children);

		// Init..
		this._init();
	}

	/**
	 * PointsMap options/settings.
	 */
	PointsMap.prototype.options = {
		// Maximum opacity that the background element of a Point can have when the point is active (mouse gets closer to it).
		maxOpacityOnActive : 0.3,
		// The distance from the mouse pointer to a Point where the opacity of the background element is 0.
		maxDistance : 70, 
		// If viewportFactor is different than -1, then the maxDistance will be overwritten by [point´s parent width / viewportFactor]
		viewportFactor : 9,
		// When the mouse is [activeOn]px away from one point, its image gets opacity = point.options.maxOpacity.
		activeOn : 30
	};

	/**
	 * Init.
	 */
	PointsMap.prototype._init = function() {
		var self = this, 
			onLoaded = function() {
				// Create the Points.
				self._createPoints();
			};

		// Preload all images.
		imagesLoaded(this.bgsWrapper, { background: true }, onLoaded);

		// Init/Bind events.
		this._initEvents();
	};

	/**
	 * Init/Bind events.
	 */
	PointsMap.prototype._initEvents = function() {
		var self = this;

		// Window resize.
		this._throttleResize = throttle(function() {
			// Update Document scroll values.
			docScrolls = {left : document.body.scrollLeft + document.documentElement.scrollLeft, top : document.body.scrollTop + document.documentElement.scrollTop};
		}, 100);
		
		window.addEventListener('resize', this._throttleResize);

		// Close content.
		this._closeContent = function() {
			var currentPoint = self.points[self.currentPoint];
			currentPoint.isActive = false;
			// Hide Point´s bgEl.
			currentPoint.bgEl.style.opacity = 0;
			// Hide content.
			self.pointsContentWrapper.classList.remove('points-content--open');
			self.contents[self.currentPoint].classList.remove('point-content--current');
			// Start mousemove event on Points.
			self._pointsAction('resume');
			// Show all points.
			self._pointsAction('show');
		};
		//this.pointsContentWrapper.addEventListener('click', this._closeContent);

		// Keyboard navigation events.
		this.el.addEventListener('keydown', function(ev) {
			var keyCode = ev.keyCode || ev.which;
			if( keyCode === 27 ) {
				self._closeContent();
			}
		});
	};

	/**
	 * Create the Points.
	 */
	PointsMap.prototype._createPoints = function() {
		this.points = [];

		var self = this;
		[].slice.call(this.pointsWrapper.querySelectorAll('.point')).forEach(function(point, pos) {
			var p = new Point(point, self.bgElems[pos], self.el, {
				maxOpacity : self.options.maxOpacityOnActive, 
				activeOn : self.options.activeOn, 
				maxDistance : self.options.maxDistance, 
				viewportFactor : self.options.viewportFactor, 
				onActive : function() {
					// Add class active (scales up the pin and changes the fill color).
					lunar.addClass(self.points[pos].el, 'point--active');
					// Hide all other points.
					self._pointsAction('hide', pos);
					// Show tooltip.
					var tooltip = self.tooltips[pos];
					tooltip.classList.add('point-tooltip--current');
					// Position tooltip.
					var rect = self.points[pos].el.getBoundingClientRect(),
						bounds = self.el.getBoundingClientRect();

					tooltip.style.left = rect.left - bounds.left + rect.width/2 + 'px';
					tooltip.style.top = rect.top - bounds.top + rect.height + 'px';
				},
				onInactive : function() {
					lunar.removeClass(self.points[pos].el, 'point--active');
					// Show all points.
					self._pointsAction('show', pos);
					// Hide tooltip.
					self.tooltips[pos].classList.remove('point-tooltip--current');
				},
				onClick : function() {
					self.currentPoint = pos;
					lunar.removeClass(self.points[pos].el, 'point--active');
					// Hide the current point (and all other points).
					self._pointsAction('hide');
					// Hide tooltip.
					self.tooltips[pos].classList.remove('point-tooltip--current');
					// Stop mousemove event on Points.
					self._pointsAction('pause');
					// Show Point´s bgEl.
					self.points[pos].bgEl.style.opacity = 1;
					// Show content.
					self.pointsContentWrapper.classList.add('points-content--open');
					self.contents[pos].classList.add('point-content--current');
				}
			});
			self.points.push(p);
		});	
	};

	/**
	 * Calls a Point´s fn. Excludes the point with index = excludedPoint.
	 */
	PointsMap.prototype._pointsAction = function(action, excludedPoint) {
		for(var i = 0, len = this.points.length; i < len; ++i) {
			if( i !== excludedPoint ) {
				this.points[i][action]();
			}
		}
	};

	window.PointsMap = PointsMap;
	document.documentElement.className = 'js';

})(window);