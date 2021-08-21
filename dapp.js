// interactions with the ethereum blockchain
// works with metamask

var DAppJS = {};
DAppJS.web3loaded = false;

DAppJS.loadWeb3 = async function(trigger){
	if (window.ethereum) {
		// listen to changes
        // load the script if it is not loaded yet
        if (typeof Web3 === "undefined"){
            var web3Loader = document.createElement('script');
            web3Loader.onload = continueLoading;
            // load latest version dynamically
            web3Loader.src = 'https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js';
            document.head.appendChild(web3Loader);
        } else {
            await continueLoading();
        }
        async function continueLoading(){
            ethereum.on('accountsChanged', function(){window.dispatchEvent(new Event('accountsChanged'));});
            ethereum.on('chainChanged', function(){window.dispatchEvent(new Event('chainChanged'));});
            ethereum.on('disconnect', function(){window.dispatchEvent(new Event('web3Disconnected'));});
            window.web3 = new Web3(window.ethereum);
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            DAppJS.actualAccount = window.web3.utils.toChecksumAddress(accounts[0]);
            if (DAppJS.actualAccount){
                web3.eth.net.getNetworkType().then(function(networkType){
                    DAppJS.actualChain = networkType;
                    window.dispatchEvent(new Event('web3Connected'));
                    DAppJS.web3loaded = true;
                });
            } else {
                window.dispatchEvent(new Event('web3NotConnected'));
            }        
        }
    } else {
        // handle no extension installed
        window.dispatchEvent(new Event('noWeb3found'));
    }
}

DAppJS.connect = function(){
    if (!DAppJS.web3loaded){
        DAppJS.loadWeb3();
        window.addEventListener('web3Connected', DAppJS.connect);
        window.addEventListener('web3Disconnected', function(){
            DAppJS.web3loaded = false;
            DAppJS.connect();
        });
    } else { 
        //window.ethereum.enable();
    }
}

DAppJS.loadContract = function(contractAddress, ABI){
	return new window.web3.eth.Contract(ABI, window.web3.utils.toChecksumAddress(contractAddress));
}

DAppJS.loadTextFile = async function(URI){
    var response = await window.fetch(URI);
    var responseText = await response.text();
    return responseText;
}

DAppJS.callContractFunction = async function(callOptions, contractAddress, ABI){
    // check if ABI passed is a string, then check if we have it
    if (typeof(ABI)==="string"){
        if (typeof(DAppJS.standardABIs[ABI.toUpperCase()])=="undefined"){
            return {success:false, result:"You didn't pass a valid ABI", resultType:"string"};
        } else {
            ABI = DAppJS.standardABIs[ABI.toUpperCase()];
        }
    }
    var methodName = callOptions.method;
    var etherValue = callOptions.value || 0;
    var parameters = callOptions.parameters;
    DAppJS.contractCounter = DAppJS.contractCounter || 0;
    DAppJS.contractCounter++;
    DAppJS.contract = DAppJS.contract || [];
    DAppJS.contract[DAppJS.contractCounter] = DAppJS.loadContract(window.web3.utils.toChecksumAddress(contractAddress), ABI);
    var functionBody = 'DAppJS.contract[DAppJS.contractCounter].methods.'+methodName+'('+parameters+').estimateGas({value: '+etherValue+',from: "'+DAppJS.actualAccount+'"});';
    var helper = new Function(functionBody);
    try{
        var callGasPrice = await eval(functionBody);
    } catch(e){
        return {success:false, result:e};
    }
    var currentGasPrice = await window.web3.eth.getGasPrice();
    // add 10% buffer for gas price and gas calculation, in order to fund the transaction
    var transactionData = {
        gas: parseInt(1.10 * callGasPrice),
        gasPrice: parseInt(1.10 * currentGasPrice),
        from: DAppJS.actualAccount,
        value: etherValue
    };
    var callString; 
    callString = 'DAppJS.contract[DAppJS.contractCounter].methods.'+methodName+'('+parameters+').call()';
    if (etherValue){
        callString = 'DAppJS.contract[DAppJS.contractCounter].methods.'+methodName+'('+parameters+').send('+JSON.stringify(transactionData)+')';
    }
    try{
        // make the call
        var callContractFunctionResult = await eval(callString);
        // get the type of result from the ABI
        var methodCall = ABI.filter( el=> el.name == methodName);
        var resultType = "undefined";
        if (methodCall.length >0){
            if (methodCall[0].outputs.length>0){
                resultType = methodCall[0].outputs[0].type || "undefined";
            }
        }
        return {success:true, result:callContractFunctionResult, resultType:resultType};
    } catch(e){
        // if an error has occurred, return it
        switch(e.code){
            case -32000:
                window.dispatchEvent(new Event('notEnoughFunds'));
                break;
            default:
                console.error(e);
        }
        var resultType="string";
        return {success:false, result:e, resultType:resultType};
    }
}

DAppJS.signPass = async function(signer, parameters){
    //recipient, avatarIndex, _message, nonce
    // get the parameters dynamically
    // {t: 'address', v: recipient}, {t: 'uint256', v:avatarIndex}, {t: 'string', v: _message}, {t: 'uint256', v: nonce}
    if (parameters.trim()==''){
        console.error('You need to pass a parameter string for the soliditySha3 function');
        return;
    }
    var hash = web3.utils.soliditySha3(parameters).toString("hex");
    return await web3.eth.sign(hash, signer);
}

DAppJS.standardABIs = [];
DAppJS.standardABIs['ERC721'] = JSON.parse('[    {      "inputs": [        {          "internalType": "string",          "name": "name_",          "type": "string"        },        {          "internalType": "string",          "name": "symbol_",          "type": "string"        }      ],      "stateMutability": "nonpayable",      "type": "constructor"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "owner",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "approved",          "type": "address"        },        {          "indexed": true,          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "Approval",      "type": "event"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "owner",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "indexed": false,          "internalType": "bool",          "name": "approved",          "type": "bool"        }      ],      "name": "ApprovalForAll",      "type": "event"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "from",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "to",          "type": "address"        },        {          "indexed": true,          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "Transfer",      "type": "event"    },    {      "inputs": [        {          "internalType": "bytes4",          "name": "interfaceId",          "type": "bytes4"        }      ],      "name": "supportsInterface",      "outputs": [        {          "internalType": "bool",          "name": "",          "type": "bool"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "owner",          "type": "address"        }      ],      "name": "balanceOf",      "outputs": [        {          "internalType": "uint256",          "name": "",          "type": "uint256"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "ownerOf",      "outputs": [        {          "internalType": "address",          "name": "",          "type": "address"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [],      "name": "name",      "outputs": [        {          "internalType": "string",          "name": "",          "type": "string"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [],      "name": "symbol",      "outputs": [        {          "internalType": "string",          "name": "",          "type": "string"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "tokenURI",      "outputs": [        {          "internalType": "string",          "name": "",          "type": "string"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "approve",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "getApproved",      "outputs": [        {          "internalType": "address",          "name": "",          "type": "address"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "internalType": "bool",          "name": "approved",          "type": "bool"        }      ],      "name": "setApprovalForAll",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "owner",          "type": "address"        },        {          "internalType": "address",          "name": "operator",          "type": "address"        }      ],      "name": "isApprovedForAll",      "outputs": [        {          "internalType": "bool",          "name": "",          "type": "bool"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "transferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "safeTransferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        },        {          "internalType": "bytes",          "name": "_data",          "type": "bytes"        }      ],      "name": "safeTransferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    }  ]');