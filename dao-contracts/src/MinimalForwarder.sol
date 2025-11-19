// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/console.sol";

/**
 * @title MinimalForwarder
 * @dev A minimal implementation of EIP-712 meta-transactions forwarder
 * This contract allows users to send transactions without paying gas fees
 * by having a relayer execute the transaction on their behalf
 */
contract MinimalForwarder {

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private constant _TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );
    
    bytes32 private constant _DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    
    bytes32 private immutable _DOMAIN_SEPARATOR;
    
    mapping(address => uint256) private _nonces;
    
    constructor() {
        _DOMAIN_SEPARATOR = keccak256(abi.encode(
            _DOMAIN_TYPEHASH,
            keccak256(bytes("MinimalForwarder")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

   
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    function getTypedDataHash(ForwardRequest memory req) public view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "\x19\x01",
            _DOMAIN_SEPARATOR,
            keccak256(abi.encode(
                _TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            ))
        ));
    }

    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        require(req.from != address(0), "Invalid from address");
        require(req.to != address(0), "Invalid to address");
        
        uint256 currentNonce = _nonces[req.from];
        if (req.nonce != currentNonce) {
            return false;
        }
        
        bytes32 hash = getTypedDataHash(req);
        address signer = recoverSigner(hash, signature);
        return signer == req.from;
    }

    function execute(ForwardRequest calldata req, bytes calldata signature) external payable {
        require(req.from != address(0), "Invalid from address");
        require(req.to != address(0), "Invalid to address");
        
        uint256 currentNonce = _nonces[req.from];
        require(req.nonce == currentNonce, "Invalid nonce");
        
        bytes32 hash = getTypedDataHash(req);
        address signer = recoverSigner(hash, signature);
        require(signer == req.from, "Invalid signature");
        
        _nonces[req.from] = currentNonce + 1;
        
        (bool success, ) = req.to.call{value: req.value}(abi.encodePacked(req.data, req.from));
        require(success, "Call failed");
    }

    /**
     * @dev Recover the signer from a hash and signature
     */
    function recoverSigner(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        
        return ecrecover(hash, v, r, s);
    }
}
