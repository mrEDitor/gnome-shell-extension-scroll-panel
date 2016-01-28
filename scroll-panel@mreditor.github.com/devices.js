/**
 * https://github.com/mrEDitor/gnome-scroll-panel
 * Copyright 2016 Edward Minasyan <mrEDitor@mail.ru>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;

const Device = new Lang.Class({
	Name: "DeviceScrollingAdapter",
	deviceName: null,
	upDirection: 1,
	direction: 0,
	delta: 0,
	deltaMin: 0,
	deltaBoost: 0,
	
	/**
	 * Input device settings.
	 * @param name : string - Name of input device.
	 * @param inversed : Inversed - Is scrolling direction inversed.
	 * @param deltaMin : int - Minimal scroll-distance.
	 * @param deltaBoost : int - Scroll-distance boost on panel hover.
	 */
	_init: function(name, inversed, deltaMin, deltaBoost) {
		this.deviceName = name;
		this.upDirection = inversed ? -1 : 1;
		this.deltaBoost = deltaBoost;
		this.deltaMin = deltaMin;
	},
	
	enter: function(target, event) {
		this.direction = 0;
		this.delta = delta_boost;
	},

	scroll: function(target, event) {
		switch (event.get_scroll_direction()) {
			case Clutter.ScrollDirection.UP:
				if (this.direction == -this.upDirection) {
					this.delta = 0;
				}
				this.direction = this.upDirection;
				break;
			case Clutter.ScrollDirection.DOWN:
				if (this.direction == this.upDirection) {
					this.delta = 0;
				}
				this.direction = -this.upDirection;
				break;
			default:
				this.delta += Math.abs(event.get_scroll_delta()[1]);
				break;
		}
		if (this.delta >= this.deltaMin) {
			const r = -this.direction;
			this.direction = 0;
			this.delta = 0;
			return r;
		} else {
			return 0;
		}
	},
});
