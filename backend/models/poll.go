
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollOption struct {
	ID    string `bson:"id" json:"id"`
	Text  string `bson:"text" json:"text"`
	Votes int    `bson:"votes" json:"votes"`
}

type Poll struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Question   string             `bson:"question" json:"question"`
	Options    []PollOption       `bson:"options" json:"options"`
	TotalVotes int                `bson:"totalVotes" json:"totalVotes"`
	Voters     []string           `bson:"voters,omitempty" json:"-"`
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}
