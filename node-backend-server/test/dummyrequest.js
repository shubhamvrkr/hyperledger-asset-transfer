const request = require('request');
request.post({url:'http://localhost:9091/login', form: {id:'nandini_rebello',key:'P@ssw0rd'}}, function(err,httpResponse,body){ 

	console.log('server responsed: ',JSON.parse(body).data.token)
	
	var header = {
			"Authorization":"JWT "+JSON.parse(body).data.token
	}
	
	var orderData = {
		
		roomno:"room_001",
		type:"ROOM_SERVICE",
		intended_user:"RECEPTIONIST",
		details:["Need to change bedsheet"]
	}
	request.post({url:'http://localhost:9091/order',form:{order:JSON.stringify(orderData)},headers:header}, function(err,httpResponse,body){ 
	
		console.log('server responsed: ',body)
		//orderData._id = 
		
	});

})