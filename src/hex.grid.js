/**
 * hex.grid.js
 */
(function(){

var
	undefined,
	window = this,
	hex = window.hex;

/**
 * The Grid prototype.
 */
var Grid = {
	
	/**
	 * Adds a grid event and handler.
	 * @param type The type of event to which to respond.
	 * @param handler The function to execute.
	 * @return this.
	 */
	addEvent: function addEvent( type, handler ) {
		if (!this.events) this.events = {};
		if (this.events[type] === undefined) this.events[type] = [];
		this.events[type].push(handler);
		return this;
	},
	
	/**
	 * Default option values.
	 */
	defaults: {
		
		// Type of grid to construct.
		type: "hexagonal"
		
	},
	
	/**
	 * Set the origin position for the grid element.
	 * @param x The horizontal position from the left in pixels.
	 * @param y The vertical position from the top in pixels.
	 */
	reorient: function reorient( x, y ) {
		this.origin.x = +x;
		this.origin.y = +y;
		this.root.style.left = x + "px";
		this.root.style.top = y + "px";
		this.elem.style.backgroundPosition = x + "px " + y + "px";
	}
	
};

hex.extend(hex, {
	
	/**
	 * Create a grid for a particular DOM element.
	 * @param elem DOM element over which to superimpose a grid.
	 * @param options Options hash defining characteristics of the grid.
	 * @return A grid object.
	 */
	grid: function grid( elem, options ) {
		
		// Confirm that an element was supplied
		if (!elem || elem.nodeType !== 1) {
			throw "no DOM element supplied";
		}
		
		// Combine options to default values
		var options = hex.extend({}, Grid.defaults, options);
		
		// Check that the particular grid type provides all reqired functions
		if (hex.grid[options.type] === undefined) {
			throw "hex.grid." + options.type + " does not exist";
		}
		
		// Setting necessary grid element characteristics
		var position = hex.style(elem, "position");
		if (position !== "relative" && position !== "absolute") {
			elem.style.position = "relative";
		}
		if (hex.style(elem, "overflow") !== "hidden") {
			elem.style.overflow = "hidden";
		}
		
		// Create and attach the root element
		var root = document.createElement("div");
		root.style.position = "absolute";
		root.style.left = "0px";
		root.style.top = "0px";
		root.style.overflow = "visible";
		elem.appendChild(root);
		
		// Create the grid object
		var g = hex.create(
			Grid, {
				events: {},
				origin: {
					x: 0,
					y: 0
				}
			},
			hex.grid[options.type],
			options, {
				elem: elem,
				root: root
			}
		);
		
		// Keep track of the last tile hovered for mouseover purposes
		var lastTile = {
			x: null,
			y: null
		};
		
		// Keep track of the panning state
		var pan = {
			panning: false,
			x: null,
			y: null
		};
		
		// Handler for any mouse movement events
		function mousemove(event) {
			
			var
				// Determine whether the event happened inside the bounds of the grid element
				inside = event.inside(elem),
				
				// Determine mouse position
				mousepos = event.mousepos(elem),
				pos = {
					x: mousepos.x - g.origin.x,
					y: mousepos.y - g.origin.y
				};
			
			// Handle panning
			if (pan.panning) {
				if (inside) {
					var
						px = pos.x - pan.x,
						py = pos.y - pan.y
					root.style.left = px + "px";
					root.style.top = py + "px";
					elem.style.backgroundPosition = px + "px " + py + "px";
				}
				return;
			}
			
			// Short-circuit if there are no tile or grid events
			if (
				!g.events.tileover &&
				!g.events.tileout &&
				!g.events.gridover &&
				!g.events.gridout
			) return;
			
			var
				timeout = 10,
				tileover = g.events.tileover,
				tileout = g.events.tileout,
				gridover = g.events.gridover,
				gridout = g.events.gridout,
				
				// Determine the grid-centric coordinates of the latest actioned tile
				mousepos = event.mousepos(elem),
				pos = {
					x: mousepos.x - g.origin.x,
					y: mousepos.y - g.origin.y
				}
				trans = g.translate(pos.x, pos.y);
			
			// Short-circuit if we're inside and there's nothing to do
			// NOTE: For example, on a mouseout or mouseover where the mousemove already covered it
			if (inside && lastTile.x === trans.x && lastTile.y === trans.y) return;
			
			// Shorthand method for queuing up a callback
			function queue(callback, args) {
				return setTimeout(function(){
					callback.apply(null, args);
				}, timeout++);
			}
			
			// Queue up tileout callbacks if there are any
			if (tileout && lastTile.x !== null && lastTile.y !== null) {
				for (var i=0, l=tileout.length; i<l; i++) {
					queue(tileout[i], [lastTile.x, lastTile.y]);
				}
			}
			
			// Queue up gridout callbacks if applicable
			if (!inside && gridout && lastTile.x !== null && lastTile.y !== null) {
				for (var i=0, l=gridout.length; i<l; i++) {
					queue(gridout[i], [lastTile.x, lastTile.y]);
				}
			}
			
			if (inside) {
				
				// Queue up gridover callbacks if applicable
				if (gridover && lastTile.x === null && lastTile.y === null) {
					for (var i=0, l=gridover.length; i<l; i++) {
						queue(gridover[i], [trans.x, trans.y]);
					}
				}
				
				// Queue up tileover callbacks if there are any
				if (tileover) {
					for (var i=0, l=tileover.length; i<l; i++) {
						queue(tileover[i], [trans.x, trans.y]);
					}
				}
				
				lastTile.x = trans.x;
				lastTile.y = trans.y;
				
			} else {
				
				lastTile.x = null;
				lastTile.y = null;
				
			}
		
		}
		
		// Add DOM event handlers to grid element for mouse movement
		hex.addEvent(elem, "mousemove", mousemove);
		hex.addEvent(elem, "mouseover", mousemove);
		hex.addEvent(elem, "mouseout", mousemove);
		
		// Keep track of last tile mousedown'ed on
		var downTile = {
			x: null, 
			y: null
		};
		
		// Handler for any mouse button events
		function mousebutton(event) {
			
			// Short-circuit if the event happened outside the bounds of the grid element.
			if (!event.inside(elem)) return;
			
			// Determine the mouse event coordinates
			var mousepos = event.mousepos(elem);
			
			// Begin panning
			if (!pan.panning && event.type === "mousedown") {
				pan.panning = true;
				pan.x = mousepos.x - g.origin.x - g.origin.x;
				pan.y = mousepos.y - g.origin.y - g.origin.y;
				elem.style.cursor = "move";
			}
			
			// Cease panning
			if (pan.panning && event.type === "mouseup") {
				g.reorient(
					mousepos.x - g.origin.x - pan.x,
					mousepos.y - g.origin.y - pan.y
				);
				pan.panning = false;
				pan.x = null;
				pan.y = null;
				elem.style.cursor = "";
			}
			
			// Short-circuit if there are no tiledown, tileup or tileclick event handlers
			if (!g.events.tiledown && !g.events.tileup && !g.events.tileclick) return;
			
			var
				// Adjusted mouse position
				pos = {
					x: mousepos.x - g.origin.x,
					y: mousepos.y - g.origin.y
				},
				
				// Grid-centric coordinates of the latest actioned tile
				trans = g.translate(pos.x, pos.y),
				
				timeout = 10,
				tiledown = g.events.tiledown,
				tileup = g.events.tileup,
				tileclick = g.events.tileclick;
			
			// Shorthand method for queuing up a callback
			function queue(callback, args) {
				return setTimeout(function(){
					callback.apply(null, args);
				}, timeout++);
			}
				
			if (event.type === "mousedown") {
				
				// Queue up tiledown callbacks
				if (tiledown) {
					for (var i=0, l=tiledown.length; i<l; i++) {
						queue(tiledown[i], [trans.x, trans.y]);
					}
				}
				
				// Remember mousedown target (to test for "click" later)
				downTile.x = trans.x;
				downTile.y = trans.y;
				
			} else if (event.type === "mouseup") {
				
				// Queue up tileup callbacks
				if (tileup) {
					for (var i=0, l=tileup.length; i<l; i++) {
						queue(tileup[i], [trans.x, trans.y]);
					}
				}
				
				// Queue up tileclick callbacks
				if (tileclick && downTile.x === trans.x && downTile.y === trans.y) {
					for (var i=0, l=tileclick.length; i<l; i++) {
						queue(tileclick[i], [trans.x, trans.y]);
					}
				}
				
				// Clear mousedown target
				downTile.x = null;
				downTile.y = null;
				
			}
			
		}
		
		// Add DOM event handlers to grid element for mouse movement
		hex.addEvent(elem, "mousedown", mousebutton);
		hex.addEvent(elem, "mouseup", mousebutton);
		
		// Perform initialization if grid supports it
		if (g.init) {
			g.init();
		}
		
		return g;
	}
	
});

})();
