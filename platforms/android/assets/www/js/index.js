/*
	Copyright 2013-2014, JUMA Technology

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/


var app = {
    
    state : "waiting_to_find",
    interval_connect : null,
    reconnect_interval : null,
    device : {},
    isAlert : false,

    initialize: function() {
	    app.bindCordovaEvents();
    },
    
    bindCordovaEvents: function() {
        document.addEventListener('bcready', app.onBCReady, false);
    },
    
    onBCReady: function() {
        BC.bluetooth.addEventListener("bluetoothstatechange",app.onBluetoothStateChange);
        BC.bluetooth.addEventListener("newdevice",app.addNewDevice);
		if(!BC.bluetooth.isopen){
			if(API !== "ios"){
				BC.Bluetooth.OpenBluetooth(function(){
				});
			}else{					
				//alert("Please open your bluetooth first.");
			}
		}
    },
    
   	onBluetoothStateChange : function(){
		if(BC.bluetooth.isopen){

		}else{
			if(API !== "ios"){
                BC.Bluetooth.OpenBluetooth(function(){
                });
            }else{                  
                //alert("Please open your bluetooth first.");
            }
		}
	},
	
	onBluetoothDisconnect: function(arg){
        BC.Proximity.clearPathLoss();
        navigator.notification.stopBeep();
        app.state = "finding";
		$('#doevent').attr('src','img/stop.png');
        app.canvas();
		app.reconnect_interval = setInterval(function(){
		   if(app.device.isConnected){
		      window.clearInterval(app.reconnect_interval);
		   }else{
		      app.device.connect(app.connectSuccess,function(){});
		   }
		},2000);
	},
    
    onDeviceConnected : function(arg){
		var deviceAddress = arg.deviceAddress;
		
	},
    
    startScan : function(){
    	$('img#spinner').attr("src","img/searching.png").addClass('img-responsive spinner').next().show();
    	$('img#spinner').attr("onclick","app.stopScan()");
    	BC.Bluetooth.StartScan();
    },
    
    addStartDevice : function(){
    	if(app.devices){
        	for(deviceAddress in app.devices){
        		var device = app.devices[deviceAddress];
		        var viewObj	= $("#user_view");
				var liTplObj=$("#li_tpl").clone();
				$(liTplObj).attr("onclick","app.device_page('"+device.deviceAddress+"')");
				liTplObj.show();
				
				for(var key in device){
					if(key == "isConnected"){
						if(device.isConnected){
							$("[dbField='"+key+"']",liTplObj).html("YES");
						}
						$("[dbField='"+key+"']",liTplObj).html("NO");
					}else{
						$("[dbField='"+key+"']",liTplObj).html(device[key]);
					}
				}
				viewObj.append(liTplObj);
        	}
        }
        app.startScan();
    },
    
    addNewDevice: function(s){
        var newDevice = s.target;
        newDevice.addEventListener("deviceconnected",app.onDeviceConnected);
        newDevice.addEventListener("devicedisconnected",app.onBluetoothDisconnect);
		var viewObj	= $("#user_view");
		var liTplObj=$("#li_tpl").clone();
		$(liTplObj).attr("onclick","app.device_page('"+newDevice.deviceAddress+"')");
		liTplObj.show();
		
		for(var key in newDevice){
			if(key == "isConnected"){
				if(newDevice.isConnected){
					$("[dbField='"+key+"']",liTplObj).html("YES");
				}
				$("[dbField='"+key+"']",liTplObj).html("NO");
			}else{
				$("[dbField='"+key+"']",liTplObj).html(newDevice[key]);
			}
		}
		viewObj.append(liTplObj);
	},
	
	onDeviceDisconnected : function(){
	   BC.Proximity.clearPathLoss();
	   navigator.notification.stopBeep();
	   $.mobile.changePage("searched.html","slideup");
	},
    
    stopScan : function(){
    	$('img#spinner').attr("src","img/arrow.png").removeClass('spinner').next().hide();
    	$('img#spinner').attr("onclick","app.startScan()");
    	BC.Bluetooth.StopScan();
    },
    
    device_page: function(deviceAddress){
		BC.Bluetooth.StopScan();
		app.devices = BC.bluetooth.devices;
		app.device = BC.bluetooth.devices[deviceAddress];
    	$.mobile.changePage("findme.html","slideup");
    },
    
    findMe : function(){
    	var img = $('#doevent').attr('src');
		if(app.state == "waiting_to_find"){
			app.state = "finding";
			app.interval_connect = window.setInterval(function(){
                var addr = sessionStorage.getItem("deviceAddress");
                app.device.connect(app.connectSuccess,function(){});
            }, 2000);
			$('#doevent').attr('src','img/stop.png');
			app.canvas();
		}else if(app.state == "finding"){
		    if(app.reconnect_interval){
                window.clearInterval(app.reconnect_interval);
            }
			app.state = "waiting_to_find";
			window.clearInterval(app.interval_connect);
			$('#doevent').attr('src','img/find.png');
			$('canvas').remove();
		}else if(app.state == "standing_by"){
			app.state = "find_me";
            BC.Findme.high_alert(app.device);
			$('#doevent').attr('src','img/refresh2.png');
		}else if(app.state == "find_me"){
			app.state = "standing_by";
			navigator.notification.stopBeep();
			BC.Findme.no_alert(app.device);
			$('#doevent').attr('src','img/refresh1.png');
		}
    },

    connectSuccess : function(){
    	window.clearInterval(app.interval_connect);
    	app.state = "standing_by";
    	$('#doevent').attr('src','img/refresh1.png');
		$('canvas').remove();
    	app.device.discoverServices(function(){            
            app.device.getServiceByUUID("ffe0")[0].discoverCharacteristics(function(){
                app.device.getServiceByUUID("ffe0")[0].characteristics[0].subscribe(app.onNotify);
            },function(){});
            BC.Proximity.onLinkLoss(app.device);
            BC.Proximity.onPathLoss(app.device,-60,-80,app.farAwayFunc,app.safetyZone_func,app.closeToFunc);
        });
        
    },

    farAwayFunc : function(){
    	app.isAlert = true;
    	navigator.notification.beep();
    	BC.Proximity.alert(app.device,BC.Proximity.ImmediateAlertUUID,'2');
    },

    safetyZone_func : function(){
    	if(app.isAlert){
    	    navigator.notification.stopBeep();
    	    BC.Proximity.alert(app.device,BC.Proximity.ImmediateAlertUUID,'0');
    	    app.isAlert = false;
    	}
    },

    closeToFunc : function(){
    	if(app.isAlert){
            navigator.notification.stopBeep();
            BC.Proximity.alert(app.device,BC.Proximity.ImmediateAlertUUID,'0');
            app.isAlert = false;
        }
    },

    onNotify:function(data){
		var value = data.value.getHexString();
		if( value == "20"){
			if (app.state == "standing_by") {
				app.state = "find_me";
				$('#doevent').attr('src','img/refresh2.png');	
		    };				
			navigator.notification.beep();
		}else if (value == "01"){
			if (app.state == "find_me") {
				app.state = "standing_by";
				$('#doevent').attr('src','img/refresh1.png');
			};
			navigator.notification.stopBeep();
		}
    },

    back : function(){
        if(app.reconnect_interval){
            window.clearInterval(app.reconnect_interval);
        }
        if(app.device.isConnected){
    		app.device.disconnect(app.onDeviceDisconnected);
    	}
    	app.state = "waiting_to_find";
    	BC.Proximity.clearPathLoss();
    	$.mobile.changePage("searched.html","slideup");
    },

    goToSetting : function(){
    	$.mobile.changePage("setting.html","slideup");
    },


	canvas : function (){
		var winHeight = sessionStorage.getItem("winHeight")-60;
		var winWidth = sessionStorage.getItem("winWidth");
		var canvas=$("<canvas id='cartoon' width='"+winWidth+"' height='"+winHeight+"'>");
		
		$('.content').append(canvas);
		
		var centerx = sessionStorage.getItem("centerx");
		var centery = sessionStorage.getItem("centery");
		
		var canvas=$('#cartoon');
		var context=canvas.get(0).getContext("2d");
		var Shape=function(x,y,z){
		  this.x=x;
		  this.y=y;
		  this.z=z;
		}

		var shapes=new Array();
		shapes.push(new Shape('rgb(119,79,35)',0.5,112));
		shapes.push(new Shape('rgb(119,79,35)',0.5,182));
		shapes.push(new Shape('rgb(119,79,35)',0.5,262));
		length1=shapes.length;
		var tmp;
		var i=0;


	    function change(){
			tmp=shapes[i];
			context.strokeStyle=tmp.x;
			context.lineWidth=tmp.y;
			context.beginPath();
			context.arc(centerx,centery,tmp.z,0,Math.PI*2,false);
			context.closePath();
			context.stroke();
			if(i<length1){
				i++;
				setTimeout(change,400);
			}
		}
	    setTimeout(change,400);
	
		function change1(){
			context.clearRect(0,0,winWidth,winHeight);
			for(j=0;j<length1;j++){
				tmp=shapes[j];
				context.strokeStyle=tmp.x;
				context.lineWidth=tmp.y;
				context.beginPath();
				context.arc(centerx,centery,tmp.z,0,Math.PI*2,false);
				context.closePath();
				context.stroke();
			}
		
		    context.strokeStyle="rgb(119,79,35,50)";
			context.lineWidth='1';
			context.beginPath();
			context.arc(centerx,centery,i,0,Math.PI*2,false);
			context.closePath();
			context.stroke();
			if(i<centerx){
				i+=20;
			}else{
				i=0;
			}
			setTimeout(change1,40);
		}
	    setTimeout(change1, 10);
	},
	
};
