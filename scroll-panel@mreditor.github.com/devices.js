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

const Direction = {
	DIRECT: 1,
	REVERSE: -1,
};

const DiscreteDevice = new Lang.Class({
	Name: "DiscreteDeviceScrollAdapter",
	deviceName: null,
	upDirection: 1,
	
	_init: function(name, direction) {
		this.deviceName = name;
		this.upDirection = direction;
	},
	
	enter: function(target, event) {
	},
	
	scroll: function(target, event) {
		switch (event.get_scroll_direction()) {
			case Clutter.ScrollDirection.UP:
				return -this.upDirection;
			case Clutter.ScrollDirection.DOWN:
				return this.upDirection;
			default:
				return 0;
		}
	},
});

const AnalogDevice = new Lang.Class({
	Name: "AnalogDeviceScrollAdapter",
	deviceName: null,
	upDirection: 1,
	direction: 0,
	delta: 0,
	deltaMin: 0,
	deltaBoost: 0,
	
	_init: function(name, direction, deltaMin, deltaBoost) {
		this.deviceName = name;
		this.upDirection = direction;
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
				return 0;
			case Clutter.ScrollDirection.DOWN:
				if (this.direction == this.upDirection) {
					this.delta = 0;
				}
				this.direction = -this.upDirection;
				return 0;
			default:
				this.delta += Math.abs(event.get_scroll_delta()[1]);
				if (this.delta >= this.deltaMin) {
					this.delta -= this.deltaMin;
					return -this.direction;
				}
				return 0;
		}
	},
});
