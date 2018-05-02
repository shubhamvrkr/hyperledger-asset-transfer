package main

import (
	
	"errors"
	"fmt"
	"strings"
	"time"
	"strconv"
	"bytes"
	"encoding/json"
	"github.com/hyperledger/fabric/core/chaincode/lib/cid"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	b64 "encoding/base64"
)

var logger = shim.NewLogger("asset_tracking")

// SimpleChaincode example simple Chaincode implementation
type AssetManagement struct {

}

type asset struct {

	AssetID    string 	`json:"assetid"` 
	Owner      string 	`json:"owner"`    
	Children   []string `json:"children"`
	Parent     []string `json:"parent"`
	Metadata   string 	`json:"metadata"`
	Consumable bool	`json:"consumable"`
}

func (t *AssetManagement) Init(stub shim.ChaincodeStubInterface) pb.Response  {

	logger.Info("########### updated asset management deployed successsfully ###########")
	return shim.Success(nil);

}

// Main handler for the invoke or query call
func (t *AssetManagement) Invoke(stub shim.ChaincodeStubInterface) pb.Response {

	logger.Info("########### asset management invoke handler ###########")

	function, args := stub.GetFunctionAndParameters()
	
	if function == "createasset" {

		//Creates an asset in state
		return t.createAsset(stub, args)
	}else if function == "transferasset" {

		// Transfers asset to new owner
		return t.transferAsset(stub, args)
	}else if function == "updateasset" {

		// Updates an assets from its state
		return t.updateAsset(stub, args)

	}else if function == "getassetsowned" {

		// Gets asset list owned by owner from state
		return t.getAssetsOwned(stub, args)
	}else if function == "getassethistory" {
		
		// Gets history for the asset from the state
		return t.getAssetHistory(stub, args)

	}else if function == "getassetdetails" {
		
		// Gets history for the asset from the state
		return t.getAssetDetails(stub, args)

	}else{

		logger.Errorf("Unknown action, check the first argument, must be one of 'createasset', 'transferasset', 'updateasset', 'getassetsowned' or 'getassethistory'. But got: %v", args[0])
		return shim.Error(fmt.Sprintf("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: %v", args[0]))
	}
}

//creates asset
func (t *AssetManagement) createAsset(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	logger.Info("########### asset management create asset ###########")
	// declare required variables
	var assetId  string;
	var owner    string;
	var children []string;
	var parents []string;
	var metadata string;


	//args[0] = assetid, args[1] = metadata, args[2] = parent
	assetId = args[0];
	fmt.Printf("\nassetId: "+assetId);
	//check if asset exits
	assetpresent,err :=  isAssetPresent(assetId,stub);
	if(err!=nil){
		return shim.Error("Failed to get asset: "+ err.Error())
	}
	if assetpresent {
		return shim.Error("Asset witht the id "+assetId+" already exits!!")
	}

	owner,err = getCommonName(stub);
	if(err!=nil){
		return shim.Error("Failed to create asset: "+ err.Error())
	}
	fmt.Printf("\nOwner: "+owner);
	metadata = args[1]
	if len(strings.TrimSpace(args[2])) > 0 {
		parents  = strings.Split(strings.TrimSpace(args[2]), ",")
	}
	//if new assets is created from some other assets
	if len(parents) > 0 {
		
		//check if the parent assets can be consumed i.e check ownership, check if it is already used to create other assets in past
		isparentsconsumable,err := isParentConsumable(owner,parents,stub)
		if err != nil{
			return shim.Error(err.Error())
		}
		if isparentsconsumable {

			// assign children array of parent assets to be this new asset and change consumable state of parent asset
			assignedconsumableforparents,err := assignConsumableChildren(assetId,parents,stub)
			if err!=nil {
				return shim.Error(err.Error())
			} else if !assignedconsumableforparents{
				return shim.Error("Parent Assets for this assets is already consumed!!")
			}

		} else {
			return shim.Error("One of the parent asset used to create this asset is already consumed or one of the parent asset is not owned by " +owner+"!!");
		}

	}
	//create the asset and convert to json bytes
	createdAsset := &asset{assetId, owner, children, parents, metadata,true}
	fmt.Printf("\nCreating asset: %+v\n", createdAsset)
	assetJSONasBytes, err := json.Marshal(createdAsset)
	if err != nil {
			return shim.Error("Failed to create the asset: "+err.Error())
	}
	fmt.Printf("\nCreating asset(JSON): \n", string(assetJSONasBytes))
	//store the asset in state
	err = stub.PutState(assetId, assetJSONasBytes)
	if err != nil {
		return shim.Error("Failed to create the asset: "+err.Error())
	}

	addstatus,err := addAssetToOwnerList(assetId,owner,stub);
	if err != nil {
		return shim.Error("Failed to add the asset with id "+assetId+" to "+owner+" list: "+err.Error())
	}
	if(!addstatus){
		return shim.Error("Failed to add asset with id "+assetId+" to "+owner+" list!")
	}
	return shim.Success(nil);
}
//transfers  asset
func (t *AssetManagement) transferAsset(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	logger.Info("########### asset management asset transfer ###########")
	//variable declaration
	var assetN asset;
	var owner,newowner,assetid string;

	//args[0] = assetid, args[1]=newowner
	assetid = args[0];
	newowner = args[1];

	//check if asset exits
	assetpresent,err :=  isAssetPresent(assetid,stub);
	if(err!=nil){
		return shim.Error("Failed to get asset: "+ err.Error())
	}
	if !assetpresent {
		return shim.Error("Asset witht the id "+assetid+" doesnt exits!!")
	}
	//get owneer from cert
	owner,err = getCommonName(stub);
	if(err!=nil){
		return shim.Error("Failed to transfer asset: "+ err.Error())
	}

	fmt.Printf("Owner: ", owner);
	fmt.Printf("New owner: ", owner);

	//check asset ownership and can be consumable
	temp_flag ,err := isAssetOwnerAndConsumable(owner,assetid,stub)
	if err!=nil {
		return shim.Error(err.Error())

	} else if !temp_flag {
	    return shim.Error("Asset with id "+assetid+" is already consumed or owner is not "+owner);

	}

	//get asset from state
    assetBytes, err := stub.GetState(assetid)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = json.Unmarshal([]byte(assetBytes), &assetN)
	if err != nil {
		return shim.Error(err.Error())
	}
	fmt.Printf("Got asset: %+v\n", assetN)

	//change the asset ownership
	assetN.Owner = newowner;

	fmt.Printf("Updated asset: %+v\n", assetN)

	assetJSONasBytes, err := json.Marshal(assetN)
	if err != nil {
		return shim.Error("Failed to transfer the asset: "+err.Error())
	}

	//store the asset in state
	err = stub.PutState(assetid, assetJSONasBytes)
	if err != nil {
		shim.Error("Failed to transfer the asset: "+err.Error())
	}

	//remove the asset from owner list
	removestatus,err := removeAssetFromOwnerList(assetid,owner,stub);
	if err != nil {
		return shim.Error("Failed to remove the asset with id "+assetid+" from "+owner+" list: "+err.Error())
	}
	if(!removestatus){
		return shim.Error("Failed to remove the asset with id "+assetid+" from "+owner+" list!")
	}

	//add the asset to new owner list
	addstatus,err := addAssetToOwnerList(assetid,newowner,stub);
	if err != nil {
		return shim.Error("Failed to add the asset with id "+assetid+" to "+newowner+" list: "+err.Error())
	}
	if(!addstatus){
		return shim.Error("Failed to add asset with id "+assetid+" to "+newowner+" list!")
	}

	return shim.Success(nil);
}

//updates asset
func (t *AssetManagement) updateAsset(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	logger.Info("########### asset management asset update ###########")
	//variable declaration
	var assetN asset;
	var owner,metadata,assetid string;

	//args[0] = assetid, args[1]=metadata
	assetid = args[0];
	metadata = args[1];

	//check if asset exits
	assetpresent,err :=  isAssetPresent(assetid,stub);
	if(err!=nil){
		return shim.Error("Failed to get asset: "+ err.Error())
	}
	if !assetpresent {
		return shim.Error("Asset witht the id "+assetid+" doesnt exits!!")
	}
	//get owner from cert
	owner,err = getCommonName(stub);
	if(err!=nil){
		return shim.Error("Failed to update asset: "+ err.Error())
	}

	fmt.Printf("Owner: ", owner);
	fmt.Printf("Metadata: ", metadata);

	//check asset ownership and can be consumable
	temp_flag ,err := isAssetOwnerAndConsumable(owner,assetid,stub)
	if err!=nil {
		return shim.Error(err.Error())

	} else if !temp_flag {
	    return shim.Error("Asset with id "+assetid+" is already consumed or owner is not "+owner);

	}

	//get asset from state
    assetBytes, err := stub.GetState(assetid)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = json.Unmarshal([]byte(assetBytes), &assetN)
	if err != nil {
		return shim.Error(err.Error())
	}
	fmt.Printf("Got asset: %+v\n", assetN)

	//change the asset ownership
	assetN.Metadata = metadata;

	fmt.Printf("Updated asset: %+v\n", assetN)

	assetJSONasBytes, err := json.Marshal(assetN)
	if err != nil {
		return shim.Error("Failed to update the asset: "+err.Error())
	}

	//store the asset in state
	err = stub.PutState(assetid, assetJSONasBytes)
	if err != nil {
		shim.Error("Failed to update the asset: "+err.Error())
	}

	return shim.Success(nil);
}

//gets asset owned by org
func (t *AssetManagement) getAssetsOwned(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	logger.Info("########### asset management get asset owned ###########")
	var owner string // Entities
	
	if len(args) != 0 {
		return shim.Error("Incorrect number of arguments. Expecting name of the person to query")
	}

	owner,err := getCommonName(stub);
	if(err!=nil){
		return shim.Error("Failed to get asset of organization: "+ err.Error())
	}
	fmt.Printf("Owner: ", owner);
	// Get the state from the ledger
	ownedAssetBytes, err := stub.GetState(owner)
	fmt.Printf("ownedAssetBytes: ", string(ownedAssetBytes));
	if err != nil {

		return shim.Error("Failed to get state for asset list: "+err.Error())
	}
	return shim.Success(ownedAssetBytes)
}

//get history for the asset
func (t *AssetManagement) getAssetHistory(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	
	logger.Info("########### asset management get asset history ###########")

	var assetid string // Entities
	
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting name of the asset to query")
	}

	assetid = args[0];
	fmt.Printf("assetid: ", assetid);
	assetpresent,err :=  isAssetPresent(assetid,stub);
	if(err!=nil){
		return shim.Error("Failed to get asset: "+ err.Error())
	}
	if !assetpresent {
		return shim.Error("Asset with the id "+assetid+" doesnt exits!!")
	}

	resultsIterator, err := stub.GetHistoryForKey(assetid)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing historic values for the marble
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		// if it was a delete operation on given key, then we need to set the
		//corresponding value null. Else, we will write the response.Value
		//as-is (as the Value itself a JSON marble)
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}

	buffer.WriteString("]")

	fmt.Printf("get history for asset returning:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

//get asset details
func (t *AssetManagement) getAssetDetails(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	
	logger.Info("########### asset management get asset history ###########")

	var assetid string // Entities
	
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting name of the person to query")
	}

	assetid = args[0];

	assetpresent,err :=  isAssetPresent(assetid,stub);
	if(err!=nil){
		return shim.Error("Failed to get asset: "+ err.Error())
	}
	if !assetpresent {
		
		return shim.Error("Asset with the id "+assetid+" doesnt exits!!")
	}
	assetDetailsBytes, err := stub.GetState(assetid)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(assetDetailsBytes)
}

//get the user id from the certificate
func getCommonName(stub shim.ChaincodeStubInterface) (string, error) {

	id, err := cid.GetID(stub)
	if err != nil {
		return "",err
	}
	sDec, err := b64.StdEncoding.DecodeString(id)
	if err != nil {
		return "",err
	}
	temp := strings.Split(string(sDec), "::");
	subject := strings.Split(temp[1],",");
	cn := strings.TrimSpace(strings.Replace(subject[0],"CN=","",-1))
	return cn,nil;
}

//check if the asset with the same id exits
func isAssetPresent(id string, stub shim.ChaincodeStubInterface) (bool,error) {

	valAsbytes, err := stub.GetState(id)
	if err != nil {
		return false,err;
	}
	if valAsbytes == nil{
		return false,nil;
	}else{
		return true,nil;
	}
}

//add mapping of assetid to owner
func addAssetToOwnerList(assetId string, owner string, stub shim.ChaincodeStubInterface) (bool,error){

	var assetOwned []string;
	assetOwnedbytes, err := stub.GetState(owner)
	if err != nil {
		return false,err
	} else if assetOwnedbytes == nil{
			assetOwned = append(assetOwned,assetId)
	}else{
		marsl_err := json.Unmarshal([]byte(assetOwnedbytes), &assetOwned)
		if marsl_err!=nil{
			return false,marsl_err;
		}
		assetOwned = append(assetOwned,assetId)
	}
	assetArrayBytes, marsl_err := json.Marshal(assetOwned)
	if marsl_err!=nil{
			return false,marsl_err;
	}
	err = stub.PutState(owner, assetArrayBytes)
	if err != nil {
		return false,err
	}
	return true,nil;
}

//remove mapping of assetid from ownerlist
func removeAssetFromOwnerList(assetId string, owner string, stub shim.ChaincodeStubInterface) (bool,error) {

	var assetOwned []string;
	assetOwnedbytes, err := stub.GetState(owner)
	if err != nil {
		return false,err
	} else if assetOwnedbytes ==nil{

			//code should not reach here..reaches means logic of maintaining asset ownlership list is buggy
			return true,errors.New("Owner doesnt contain the asset "+assetId+" trying to transer!!!");
	}else{

		marsl_err := json.Unmarshal([]byte(assetOwnedbytes), &assetOwned)
		if marsl_err!=nil{
			return false,marsl_err;
		}
		assetOwned = remove(assetOwned,assetId)
	}
	assetArrayBytes, marsl_err := json.Marshal(assetOwned)
	if marsl_err!=nil{
			return false,marsl_err;
	}
	err = stub.PutState(owner, assetArrayBytes)
	if err != nil {
		return false,err
	}
	return true,nil;
}

// traverse each parent and check if the owner owns this assets to consume it and also check if it is consumed in some other asset
func isParentConsumable(owner string, parents []string, stub shim.ChaincodeStubInterface) (bool,error) {

	for _, parentid := range parents {

		//get the details of parent asset and check for ownership and consumable state
		temp_flag ,err := isAssetOwnerAndConsumable(owner,parentid,stub)
		if err!=nil{
			return false,err;
		} else if !temp_flag {
			return false,errors.New("Asset with id "+parentid+" is already consumed or owner is not "+owner);
		}
    }
	return true, nil;
}

//checking if the asset is consumable and the owner is the one that is trying to consume the asset
func isAssetOwnerAndConsumable(owner string, assetid string, stub shim.ChaincodeStubInterface) (bool,error) {

	var parentasset asset;
	var can_consume bool;
	can_consume = false;

	assetBytes, err := stub.GetState(assetid)
	if err != nil {
		return can_consume,err
	} else if assetBytes ==nil{
		return can_consume,errors.New("No asset found with id "+assetid)
	} else{

		//got the parent asset, now checking begins
		err = json.Unmarshal([]byte(assetBytes), &parentasset)
		if err != nil {
			return can_consume,err
		}
		if strings.Compare(parentasset.Owner, owner) == 0 {
			//owner is same for parent asset
			if(parentasset.Consumable){
				can_consume=true;
			}else{
				return can_consume,errors.New("Asset with id "+assetid+" is already consumed!!")
			}

		}else{
			return can_consume,errors.New("Owner for asset with id "+assetid+" is not "+owner)
		}
	}
	return can_consume,nil;
}

//set children of the parent asset to be the asset in which it is being consumed, also change the consumable status to false to ensure it cannot be consumed in future. 
func assignConsumableChildren(assetId string,parents []string, stub shim.ChaincodeStubInterface ) (bool,error) {
	
	var changesCommited bool;
	changesCommited = false;
	var parentasset asset;
	for _, parentid := range parents {

			assetBytes, err := stub.GetState(parentid)
			if err != nil {
				return changesCommited,err
			} else if assetBytes ==nil{
				return changesCommited,errors.New("No asset found with id "+parentid)
			} else{
				//got the parent asset, now checking begins
				err = json.Unmarshal([]byte(assetBytes), &parentasset)
				if err != nil {
					return changesCommited,err
				}
				parentasset.Consumable = false;
				parentasset.Children = append(parentasset.Children,assetId)
				fmt.Printf("Changed parent asset: %+v\n", parentasset)
				assetJSONasBytes, err := json.Marshal(parentasset)
				if err != nil {
					return changesCommited,errors.New("Failed to create the asset: "+err.Error())
				}
				//store the asset in state
				err = stub.PutState(parentid, assetJSONasBytes)
				if err != nil {
					return changesCommited,errors.New("Failed to create the asset: "+err.Error())
				}
			}
    }
	return true,nil
}

func remove(s []string, r string) []string {
    for i, v := range s {
        if v == r {
            return append(s[:i], s[i+1:]...)
        }
    }
    return s
}

func main() {
	err := shim.Start(new(AssetManagement))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
