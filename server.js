// Server and DB
const http 		= require('http');
const express 		= require('express');
const app 		= express();
const bodyParser 	= require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const sqlite3 		= require('sqlite3');
// Config Files
const orgABI		= require('./orgABI.json');
const tokenABI		= require('./tokenABI.json');
const config		= require('./config');
// SMS
const MessagingResponse = require('twilio').twiml.MessagingResponse;
let twiml		= new MessagingResponse();
const accountSid 	= config.twilioAccountSid;
const authToken 	= config.twilioAuthToken;
const smsClient 	= require('twilio')(accountSid, authToken);
const outgoing_number   = config.twilioNumber;
let incoming_number_string;
// Wallet
const HDWalletProvider 	= require('truffle-hdwallet-provider');
const provider		= new HDWalletProvider(config.HDWallet_mneumonic, config.HDWallet_uri);
// Web3
const Web3 		= require('web3');
const web3 		= new Web3(provider);
// Contract and Token Objects
const orgContract 	= new web3.eth.Contract(orgABI, config.orgAddress);
const tokenContract	= new web3.eth.Contract(tokenABI, config.tokenAddress);

////////////////////
// HTTP Functions //
////////////////////

// When Twilio receives an SMS, it sends a POST to this server, triggering this
app.post('/sms', (req, res) => {
	
	// Get the phone number that sent the message
	incoming_number_string = req.body.From;
	incoming_number_int = parseInt( incoming_number_string.substring(1) );

	// Get the actual message sent
	let incoming_message = req.body.Body.toLowerCase();
	console.log(twiml.toString());
	
	// Log to console
	console.log('\n\n\n--> INCOMING NUMBER: ' + incoming_number_int);
	console.log('-> INCOMING MESSAGE: ' + incoming_message);

	// Execute the command
	executeCommand(incoming_number_int, incoming_message);
	
	// Clear default account memory
	web3.eth.defaultAccount = null;

});

// Create Server
//http.createServer(app).listen(1337, () => {
// 	console.log('Express server listening on port 1337');
//});
http.createServer(app).listen(process.env.PORT || 1337, () => {
	console.log('Express server up');
});

/////////////////////////////////////
// Functions For Command Execution //
/////////////////////////////////////

// This is the master function
async function executeCommand(phoneNumber, textMessage) {

	// Get the command and modifiers and log them 
	var firstWord = textMessage.replace(/ .*/,'');
	var restOfMessage = textMessage.substring(firstWord.length).trim();
	
	console.log("	Command   = " + firstWord);
	console.log("	Modifiers = " + restOfMessage);

	account = await getPrivateKeyFromNumber(phoneNumber)
		.then(key => getAccountFromPrivateKey(key))
		.catch((error) => console.log(error));
	console.log(account);
	callFunction(account, firstWord, restOfMessage);
	
	// Clear memory
	account = null;
}

// Get private key from a telephone number
async function getPrivateKeyFromNumber(phoneNumber) {
	var query = 'SELECT PrivateKey FROM Token_Holder WHERE PhoneNumber = ' + phoneNumber;
	// Do this chaining thing
	return await singleQueryDatabase(query)
		.then( row => key = row.PrivateKey )
		.catch( error => console.log(error));
}

// Get account object from private key
function getAccountFromPrivateKey(privateKey) {
		return(web3.eth.accounts.privateKeyToAccount(privateKey));
}

// This calls a function corresponding to a text command
function callFunction(account, command, modifiers) {
	switch(command) {
		case "command":
		case "commands":
			commands_Command();
			break;
		case "view":
			view_Command(account, modifiers);
			break;
		case "vote":
			vote_Command(account, modifiers);
			break;
		case "submit":
			submit_Command(account, modifiers);
			break;
		case "admin":
			admin_Command(account, modifiers);
			break;
		default:
			sendNoSuchCommandFound();
			break;
	}
}

// Sums up all of the total amount donated
async function totalAmountDonated() {
	var query = 'SELECT SUM(DollarsDonated) FROM Token_Holder';
	return await queryDatabase(query);
}

/////////////////////////////////////////////////
// Texting, Database, and Auxilliary Functions //
/////////////////////////////////////////////////

// Retrieve a single databse value
async function singleQueryDatabase(query, args) {
	return new Promise( (resolve, reject) => {
		let db = new sqlite3.Database('./db/db.db');
		db.get(query, args, (err, row) => {
			if (err) { console.log(err); }
			resolve(row);
		});
		db.close();
	});
}

// Perform general database query
async function queryDatabase(query, args) {
	return new Promise( (resolve, reject) => {
		let db = new sqlite3.Database('./db/db.db');
		db.each(query, args, (err, rows) => {
			if (err) { console.log(err); }
			resolve(rows);
		});
		db.close();
	});
}

// Perform general database insert
async function insertDatabase(query, params) {
	return new Promise( (resolve, reject) => {
		let db = new sqlite3.Database('./db/db.db');
		db.run(query, params, function(err) {
			if (err) {
				console.log(err); 
				sendSMSTo(err);
			}
		});
		db.close();
	});
}

// Send text message
function sendSMS(message) {
	//console.log(incoming_number_string);
	//console.log(outgoing_number);
	smsClient.messages.create({
		body: message,
		to: incoming_number_string,
		from: outgoing_number
	});
}

// Send text to a number that is not the replying one
function sendSMSTo(number, message) {
	//console.log(incoming_number_string);
	//console.log(outgoing_number);
	smsClient.messages.create({
		body: message,
		to: number,
		from: outgoing_number
	});
}

// Send generic no command found message
function sendNoSuchCommandFound(){
	sendSMS('No such command found. Type \'commands\' for a list of commands.');
}

function firstMessage() {
	sendSMS('Welcome to the Hoya Helpers Foundation!')
}

// Makes web3 call 
async function makeWeb3Call(toAddress, functionDataABI) {
	return new Promise( (resolve, reject) => {
		web3.eth.call({
			to: toAddress,
			data: functionDataABI
		}, function(err, result) {
			if (result) {
				resolve(result);		
			} else {
				console.log(err);
			}
		});	
	});
}

////////////////////////////////////////////
// These are the actual Command Functions //
////////////////////////////////////////////

function commands_Command() {
	//sendSMS('View token balance\nView total fund\nView recent proposals\nVote on proposal\nSubmit new proposal');
	sendSMS('View token balance\nView total fund\nView recent proposals\nVote (Prop #) (Y/N)');
}

async function view_Command(account, modifiers) {
	switch(modifiers) {
		case "token balance":
			//viewTokenBalance(account);
			viewTokenBalanceFake(account);
			break;
		case "total fund":
			viewTotalFund();
			break;
		case "recent proposals":
			viewRecentProposals();
			break;
		default:
			sendNoSuchCommandFound();
			break;
	}
}

async function vote_Command(account, modifiers) {
	switch(modifiers) {
		default:
			vote(account, modifiers);
			break;
	}
}

////////////////////////////////////
// These are Subcommand Functions //
////////////////////////////////////

// VIEW //

async function viewTokenBalance(account) {
	var holderAddress = account.address.substring(2);
	var functionData = ('0x70a08231000000000000000000000000' + holderAddress);
	var call = await makeWeb3Call(config.tokenAddress, functionData);
	var tokens = web3.utils.toBN(call).toString();
	//console.log('Secentitokens Owned: ' + tokens);
	sendSMS('You own ' + (parseInt(tokens)/10000).toFixed(4) + ' SMP Tokens.');
}

async function viewTokenBalanceFake(account) {
	var query = 'SELECT TokenBalance FROM Token_Holder WHERE PhoneNumber = ' + incoming_number_string;
	var balance = await singleQueryDatabase(query)
		.then( row => balance = row.TokenBalance )
		.catch( error => console.log(error));
	sendSMS('You own ' + balance + ' SMP Tokens.');
		//sendSMS('You own ' + tokenBalanceFake + ' SMP Tokens.');
	
		//account = await getPrivateKeyFromNumber(phoneNumber)
		//.then(key => getAccountFromPrivateKey(key))
		//.catch((error) => console.log(error));
}

async function getPrivateKeyFromNumber(phoneNumber) {
	var query = 'SELECT PrivateKey FROM Token_Holder WHERE PhoneNumber = ' + phoneNumber;
	// Do this chaining thing
	return await singleQueryDatabase(query)
		.then( row => key = row.PrivateKey )
		.catch( error => console.log(error));
}

async function viewTotalFund() {
	var functionData = '0x18160ddd000000000000000000000000';
	var totalSum = (await totalAmountDonated())['SUM(DollarsDonated)'];
	var call = await makeWeb3Call(config.tokenAddress, functionData);
	var supply = web3.utils.toBN(call).toString();
	sendSMS('There are ' + (parseInt(supply)/10000).toFixed(4) + ' SMP Tokens in supply.'
		+ '\nThe Decentralized Fund contains a total of ' + totalSum*0.8 + ' dollars.');
}

async function viewRecentProposals() {
	await orgContract.getPastEvents('ProposalAdded',{
		filter: { }, 
		fromBlock: 0, 
		toBlock: 'latest' }
	).then(function(results) {
		// console.log(results);
		// For each proposal, list number, amount, and description
		for (i=results.length-5; i<results.length; i++) {
			if( i<0 ) i = 0;
			var proposalID 	= results[i].returnValues[0];
			var weiAmount 	= results[i].returnValues[2];
			var description = results[i].returnValues[3];
			// Todo: add the voting deadline.
			sendSMS("Propsal " + proposalID + ":\n" + "$" + weiAmount + "\n- " + description);
		}
	},function(error) {
		console.log(error)
		sendSMS("Eroor. No recent proposals found.")
	});
}

// VOTE //

async function vote(account, modifiers) {

	// Break up modifiers
	modifiers = modifiers.split(" ");
	if( modifiers.length != 2) {
		sendSMS("Input error. Type \"vote [Proposal Number] [Y or N]\" to vote on a proposal."); 
		return;
	}
	var propNumber = modifiers[0];
	var vote = modifiers[1];
	var support;

	//Set support
	if (vote == "y") support = true;
	else if (vote == "n") support = false;
	else {
		sendSMS("Input error. Type \"vote [Proposal Number] [Y or N]\" to vote on a proposal."); 
		return;
	}

	// Set contract from address
	web3.eth.defaultAccount = account.address;
	orgContract.from = account.address;
	console.log("3: "+ await web3.eth.getAccounts());

	// Trigger vote
	try {
		var transaction = orgContract.methods.vote(propNumber, support)
		account.signTransaction(transaction, account.privateKey)
			.then(transaction.send({
				from: account.address,
				gas: (await transaction.estimateGas({from: account.address})*2)
			})).catch(function(error) {
				console.log(error);
				sendSMS("Error: cannot vote.");
			});
	} catch (error) {
		console.log(error);
		sendSMS("Error. You have already voted on this proposal.");
	};

	//transaction.gas = await transaction.estimateGas({from: account.address})*2;
	//account.signTransaction(transaction, account.privateKey)
	//.then(transaction.send({
	//	from: account.address,
	//	gas: (await transaction.estimateGas({from: account.address})*2)
	//})).catch(function(error) {
	//	console.log(error);
	//	sendSMS("Error: cannot vote.");
	//});

        //web3.eth.accounts.signTransaction(transaction, account.privateKey )
	//.then(transaction.send({from: account.address}))
	//.catch(error => console.log(error));
	//orgContract.methods.vote(propNumber, support).send(function(result) {
	//	console.log(result);
	//}, function(error) {
	//	console.log(error);
	//});	
}

// ADMIN //

function admin_Command(account, modifiers) {
	if (incoming_number_string != "+14046429205") {
		sendNoSuchCommandFound();
	} else {
		modifiers = modifiers.split(" ");
		switch(modifiers[0]) {
			case "create":
				adminCreateTokenHolder(modifiers); // admin create (phone #) (FN) (LN) (Donation) (# of tokens)
				break;
			case "generate wallet":
				web3.eth.personal.newAccount('aw96B691972022');
				break;
			default:
				sendSMS("No such admin commands found");
				break;
		}
	}
}

async function adminCreateTokenHolder(modifiers) {
	if (modifiers.length != 6) {
		sendSMS("Error. Admin create (Phone) (FN) (LN) (Donation) (Token Bal) required.");
		return;
	}
	// Create new account + query 
	var newAccount = web3.eth.accounts.create();
	var newNumber = modifiers[1];
	var newBalance = modifiers[5];
	var query = "INSERT INTO Token_Holder VALUES (" + newNumber + ",'" +  modifiers[2] + "','" +  modifiers[3] 
		+ "','" + newAccount.privateKey + "','" + newAccount.address + "'," + modifiers[4] + "," + newBalance + ")";
	
	// Add to database
	console.log(query);
	insertDatabase(query);

	// Prompt User
	sendSMSTo(newNumber,"Welcome to the Hoya Helpers Foundation! You have recieved " 
		+ newBalance + " SMP Tokens. Text \"commands\" for a list of commands.");
}
